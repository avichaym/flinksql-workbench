/**
 * SessionManager - Manages Flink session lifecycle (Singleton)
 * Handles session creation, validation, and cleanup
 * Shared across all statement executions
 */
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('SessionManager');

class SessionManager {
  static instance = null;
  
  constructor(flinkApi) {
    // Implement singleton pattern
    if (SessionManager.instance) {
      return SessionManager.instance;
    }
    
    log.traceEnter('constructor');
    
    this.flinkApi = flinkApi;
    this.currentSession = null;
    this.sessionStartTime = null;
    this.sessionProperties = {
      'sql-gateway.session.idle-timeout': '30min', // 30 minutes
      'sql-gateway.session.check-interval': '1min'
    };
    this.listeners = new Set();
    this.debugLogFunction = null; // Will be set by App.jsx (deprecated - use logger instead)
    
    SessionManager.instance = this;
    log.traceExit('constructor');
  }
  
  // Static method to get singleton instance
  static getInstance(flinkApi) {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(flinkApi);
    }
    return SessionManager.instance;
  }

  // Set the debug logging function from App.jsx (DEPRECATED - for backward compatibility)
  setDebugLogFunction(logFunction) {
    this.debugLogFunction = logFunction;
  }

  // Legacy logging function (DEPRECATED - use logger directly)
  log(message, type = 'info') {
    if (this.debugLogFunction) {
      this.debugLogFunction(message, type);
    } else {
      log.info('log', message);
    }
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
        log.error('notifyListeners', `Error in session listener: ${error.message}`);
      }
    });
  }

  // Get current session information
  getSessionInfo() {
    log.trace('getSessionInfo', 'Getting session info');
    
    return {
      sessionHandle: this.currentSession?.sessionHandle || null,
      isActive: !!this.currentSession,
      startTime: this.sessionStartTime,
      age: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      properties: this.sessionProperties
    };
  }

  // Update session properties (for UI configuration)
  updateSessionProperties(newProperties) {
    log.traceEnter('updateSessionProperties', { newProperties });
    log.info('updateSessionProperties', `Updating session properties: ${JSON.stringify(newProperties, null, 2)}`);
    
    this.sessionProperties = { ...newProperties };
    this.notifyListeners();
    
    log.traceExit('updateSessionProperties');
  }

  // Create a new session
  async createSession(customProperties = {}) {
    log.traceEnter('createSession', { customProperties });
    log.info('createSession', 'Creating new Flink session...');
    
    try {
      const properties = {
        ...this.sessionProperties,
        ...customProperties
      };

      this.log(`Session properties: ${JSON.stringify(properties, null, 2)}`);
      
      const response = await this.flinkApi.createSession(properties);
      
      this.currentSession = {
        sessionHandle: response.sessionHandle,
        properties: properties,
        createdAt: new Date().toISOString(),
        lastUsed: Date.now()
      };
      
      this.sessionStartTime = Date.now();
      
      this.log(`Session created: ${response.sessionHandle}`);
      
      this.notifyListeners();
      return this.currentSession;
      
    } catch (error) {
      this.log(`❌ Failed to create session: ${error.message}`);
      this.currentSession = null;
      this.sessionStartTime = null;
      this.notifyListeners();
      throw error;
    }
  }

  // Get or create a session
  async getSession() {
    if (!this.currentSession) {
      this.log('No active session, creating new one...');
      await this.createSession();
    } else {
      this.log(`Reusing existing session: ${this.currentSession.sessionHandle}`);
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
      this.log(`Validating session: ${this.currentSession.sessionHandle}`);
      await this.flinkApi.getSession(this.currentSession.sessionHandle);
      this.log('Session is valid');
      return true;
    } catch (error) {
      this.log(`⚠️ Session validation failed: ${error.message}`);
      this.currentSession = null;
      this.sessionStartTime = null;
      this.notifyListeners();
      return false;
    }
  }

  // Close current session
  async closeSession() {
    if (!this.currentSession) {
      this.log('No active session to close');
      return;
    }

    try {
      this.log('🔒 Closing session: ' + this.currentSession.sessionHandle);
      await this.flinkApi.closeSession(this.currentSession.sessionHandle);
      this.log('✅ Session closed successfully');
    } catch (error) {
      this.log('⚠️ Error closing session: ' + error.message);
    } finally {
      this.currentSession = null;
      this.sessionStartTime = null;
      this.notifyListeners();
    }
  }

  // Refresh session (close and create new)
  async refreshSession() {
    this.log('🔄 Refreshing session...');
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
