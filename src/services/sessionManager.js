class SessionManager {
  constructor(flinkApi) {
    this.flinkApi = flinkApi;
    this.currentSession = null;
    this.sessionStartTime = null;
    this.sessionProperties = {
      'execution.runtime-mode': 'batch',
      'sql-gateway.session.idle-timeout': '30min', // 30 minutes
      'sql-gateway.session.check-interval': '1min'
    };
    this.listeners = new Set();
  }

  // Add listener for session changes
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners of session changes
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.getSessionInfo());
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  // Get current session information
  getSessionInfo() {
    return {
      sessionHandle: this.currentSession?.sessionHandle || null,
      isActive: !!this.currentSession,
      startTime: this.sessionStartTime,
      age: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      properties: this.sessionProperties
    };
  }

  // Create a new session
  async createSession(customProperties = {}) {
    console.log('Creating new Flink session...');
    
    try {
      const properties = {
        ...this.sessionProperties,
        ...customProperties
      };

      console.log('Session properties:', JSON.stringify(properties, null, 2));
      
      const response = await this.flinkApi.createSession(properties);
      
      this.currentSession = {
        sessionHandle: response.sessionHandle,
        properties: properties,
        createdAt: new Date().toISOString(),
        lastUsed: Date.now()
      };
      
      this.sessionStartTime = Date.now();
      
      console.log('Session created:', JSON.stringify(this.currentSession, null, 2));
      
      this.notifyListeners();
      return this.currentSession;
      
    } catch (error) {
      console.error('Failed to create session:', error);
      this.currentSession = null;
      this.sessionStartTime = null;
      this.notifyListeners();
      throw error;
    }
  }

  // Get or create a session
  async getSession() {
    if (!this.currentSession) {
      console.log('No active session, creating new one...');
      await this.createSession();
    } else {
      console.log('Reusing existing session:', this.currentSession.sessionHandle);
      this.currentSession.lastUsed = Date.now();
    }
    
    return this.currentSession;
  }

  // Validate if current session is still active
  async validateSession() {
    if (!this.currentSession) {
      return false;
    }

    try {
      console.log('Validating session:', this.currentSession.sessionHandle);
      await this.flinkApi.getSession(this.currentSession.sessionHandle);
      console.log('Session is valid');
      return true;
    } catch (error) {
      console.warn('⚠️ Session validation failed:', error.message);
      this.currentSession = null;
      this.sessionStartTime = null;
      this.notifyListeners();
      return false;
    }
  }

  // Execute SQL with session management
  async executeSQL(statement) {
    console.log(`Executing SQL with session management: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
    
    // Ensure we have a valid session
    let session = await this.getSession();
    
    // Validate session before use
    const isValid = await this.validateSession();
    if (!isValid) {
      console.log('Session invalid, creating new one...');
      session = await this.createSession();
    }

    try {
      // Submit statement
      console.log('Submitting statement to session:', session.sessionHandle);
      const operationResponse = await this.flinkApi.submitStatement(session.sessionHandle, statement);
      const operationHandle = operationResponse.operationHandle;

      // Poll for completion
      let status = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait time
      
      while (status === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
        
        const statusResponse = await this.flinkApi.getOperationStatus(session.sessionHandle, operationHandle);
        status = statusResponse.status;
        console.log(`⏳ Operation status (attempt ${attempts}): ${status}`);
      }

      if (attempts >= maxAttempts) {
        throw new Error('Query execution timeout after 60 seconds');
      }

      // Get results if successful
      let results = [];
      let columns = [];
      let jobId = null;
      let resultKind = null;

      if (status === 'FINISHED') {
        const firstResult = await this.flinkApi.getOperationResults(session.sessionHandle, operationHandle, 0);
        
        console.log(`🔍 First result for analysis:`, JSON.stringify(firstResult, null, 2));
        
        if (firstResult.results) {
          jobId = firstResult.jobID;
          resultKind = firstResult.resultKind;
          
          // Get all results with columns
          const allResults = await this.flinkApi.getAllResults(session.sessionHandle, operationHandle);
          results = allResults.results;
          columns = allResults.columns;
          
          console.log(`Final execution results:`, JSON.stringify({
            resultKind,
            jobId,
            columnsCount: columns.length,
            rowsCount: results.length,
            columns: columns.map(c => c.name),
            sampleData: results.slice(0, 3)
          }, null, 2));
        }
      }

      // Update session last used time
      this.currentSession.lastUsed = Date.now();

      return {
        status,
        results,
        columns,
        jobId,
        resultKind,
        sessionHandle: session.sessionHandle,
        operationHandle
      };

    } catch (error) {
      console.error('SQL execution failed:', error);
      
      // If it's a session-related error, invalidate the session
      if (error.message.includes('session') || error.message.includes('404')) {
        console.log('Session error detected, invalidating session');
        this.currentSession = null;
        this.sessionStartTime = null;
        this.notifyListeners();
      }
      
      return {
        status: 'ERROR',
        error: error.message,
        sessionHandle: session?.sessionHandle,
        results: [],
        columns: []
      };
    }
  }

  // Close current session
  async closeSession() {
    if (!this.currentSession) {
      console.log('No active session to close');
      return;
    }

    try {
      console.log(' Closing session:', this.currentSession.sessionHandle);
      await this.flinkApi.closeSession(this.currentSession.sessionHandle);
      console.log(' Session closed successfully');
    } catch (error) {
      console.warn(' Error closing session:', error.message);
    } finally {
      this.currentSession = null;
      this.sessionStartTime = null;
      this.notifyListeners();
    }
  }

  // Refresh session (close and create new)
  async refreshSession() {
    console.log(' Refreshing session...');
    await this.closeSession();
    return await this.createSession();
  }

  // Get session age in human readable format
  getSessionAge() {
    if (!this.sessionStartTime) return 'No active session';
    
    const ageMs = Date.now() - this.sessionStartTime;
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageSeconds = Math.floor((ageMs % 60000) / 1000);
    
    if (ageMinutes > 0) {
      return `${ageMinutes}m ${ageSeconds}s`;
    } else {
      return `${ageSeconds}s`;
    }
  }
}

export default SessionManager;
