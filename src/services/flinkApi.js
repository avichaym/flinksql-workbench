import logger from '../utils/logger.js';

const log = logger.getModuleLogger('FlinkApi');

class FlinkApiService {
  constructor(baseUrl = '/api/flink') {
    log.traceEnter('constructor', { baseUrl });
    
    this.baseUrl = baseUrl;
    this.apiVersion = 'v1'; // Default to v1, will auto-detect
    this.useProxy = baseUrl.startsWith('/api/flink'); // Use proxy by default
    this.credentials = null; // Store authentication credentials
    
    log.traceExit('constructor');
  }

  setBaseUrl(url) {
    log.traceEnter('setBaseUrl', { url });
    
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url; // Remove trailing slash
    
    // Use proxy for:
    // 1. URLs that start with /api/flink (explicit proxy)
    // 2. External URLs (not localhost) to avoid CORS issues
    this.useProxy = url.startsWith('/api/flink') || 
                   (!url.includes('localhost') && (url.startsWith('http://') || url.startsWith('https://')));
    
    log.info('setBaseUrl', `Base URL: ${this.baseUrl} (proxy: ${this.useProxy})`);
    log.traceExit('setBaseUrl');
  }

  setCredentials(username, password, apiToken) {
    log.traceEnter('setCredentials', { username: username ? '***' : '', hasPassword: !!password, hasApiToken: !!apiToken });
    this.credentials = { username, password, apiToken };
    log.traceExit('setCredentials');
  }

  getProxyUrl(endpoint) {
    if (this.useProxy) {
      // If baseUrl is already a proxy path, use it directly
      if (this.baseUrl.startsWith('/api/flink')) {
        return `${this.baseUrl}${endpoint}`;
      }
      return `/api/flink${endpoint}`;
    }
    return `${this.baseUrl}${endpoint}`;
  }

  async request(endpoint, options = {}) {
    const url = this.getProxyUrl(endpoint);
    
    log.info('request', `Making request to: ${url} (using ${this.useProxy ? 'proxy' : 'direct'} connection)`);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // Add authentication headers if credentials are available
    if (this.credentials) {
      if (this.credentials.apiToken) {
        // Use Bearer token if available
        headers['Authorization'] = `Bearer ${this.credentials.apiToken}`;
      } else if (this.credentials.username && this.credentials.password) {
        // Use basic authentication
        const encoded = btoa(`${this.credentials.username}:${this.credentials.password}`);
        headers['Authorization'] = `Basic ${encoded}`;
      }
    }
    
    const config = {
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        log.error('request', `HTTP error! status: ${response.status}, body: ${errorText}`);
        
        // Try to parse error as JSON for better error details
        let errorDetails = null;
        let processedErrorMessage = errorText;
        
        try {
          errorDetails = JSON.parse(errorText);
          log.error('request', `Parsed error details: ${JSON.stringify(errorDetails)}`);
          
          // Extract root cause from Java exception if present
          if (errorDetails.errors && Array.isArray(errorDetails.errors)) {
            const rootCause = this.extractRootCause(errorDetails.errors);
            if (rootCause) {
              processedErrorMessage = rootCause;
            }
          }
        } catch (parseError) {
          log.warn('request', 'Could not parse error response as JSON');
        }
        
        throw new Error(`HTTP error! status: ${response.status} - ${processedErrorMessage}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      log.error('request', `Flink API request failed: ${error.message}`);
      log.error('request', `Request details: ${options.method || 'GET'} ${endpoint}`);
      log.error('request', `URL used: ${url}`);
      log.error('request', `Connection mode: ${this.useProxy ? 'proxy' : 'direct'}`);
      
      // Check if it's a CORS error
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        log.error('request', 'This looks like a CORS/Network error. Possible solutions:');
        
        if (!this.useProxy) {
          log.error('request', '1. RECOMMENDED: Use proxy URL "/api/flink" instead of direct URL');
          log.error('request', '2. Make sure Flink SQL Gateway allows CORS from your origin');
        } else {
          log.error('request', '1. Check that Flink SQL Gateway is running on localhost:8083');
          log.error('request', '2. Verify the Vite dev server proxy configuration');
          log.error('request', '3. Try restarting the dev server');
        }
        
        log.error('request', '4. Check browser network tab for more details');
      }
      
      throw error;
    }
  }

  // Get Flink info and auto-detect API version
  async getInfo() {
    log.traceEnter('getInfo');
    
    try {
      // Try v1 first
      const result = await this.request('/v1/info');
      this.apiVersion = 'v1';
      log.info('getInfo', 'Using Flink API v1');
      log.traceExit('getInfo', result);
      return result;
    } catch (error) {
      try {
        const result = await this.request('/v2/info');
        this.apiVersion = 'v2';
        log.info('getInfo', 'Using Flink API v2');
        log.traceExit('getInfo', result);
        return result;
      } catch (error2) {
        log.error('getInfo', `Both API v1 and v2 failed: ${error2.message}`);
        throw error2;
      }
    }
  }

  // Create a new session
  async createSession(properties = {}) {
    log.traceEnter('createSession', { properties });
    
    const endpoint = `/${this.apiVersion}/sessions`;
    log.info('createSession', 'Creating session');
    
    // Flink SQL Gateway expects properties to be wrapped in a "properties" field
    const requestBody = {
      properties: properties
    };
    
    const response = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    log.info('createSession', `Session created: ${response.sessionHandle}`);
    log.traceExit('createSession', response);
    return response;
  }

  // Get session info
  async getSession(sessionHandle) {
    log.traceEnter('getSession', { sessionHandle });
    
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}`;
    const response = await this.request(endpoint);
    
    log.traceExit('getSession', response);
    return response;
  }

  // Close a session
  async closeSession(sessionHandle) {
    log.traceEnter('closeSession', { sessionHandle });
    
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}`;
    log.info('closeSession', `Closing session: ${sessionHandle}`);
    
    const response = await this.request(endpoint, {
      method: 'DELETE',
    });
    
    log.info('closeSession', 'Session closed');
    log.traceExit('closeSession', response);
    return response;
  }

  // Submit a SQL statement
  async submitStatement(sessionHandle, statement) {
    log.traceEnter('submitStatement', { sessionHandle, statementLength: statement.length });
    
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}/statements`;
    const truncatedStatement = statement.length > 100 ? `${statement.substring(0, 100)}...` : statement;
    log.info('submitStatement', `Executing SQL: ${truncatedStatement}`);
    
    const response = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ statement }),
    });
    
    log.info('submitStatement', `Statement submitted: ${response.operationHandle}`);
    log.traceExit('submitStatement', response);
    return response;
  }

  // Get operation status
  async getOperationStatus(sessionHandle, operationHandle) {
    log.trace('getOperationStatus', 'getOperationStatus', `Checking status for operation: ${operationHandle}`);
    
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}/operations/${operationHandle}/status`;
    
    const response = await this.request(endpoint);
    
    // Only log status changes or errors, not every poll
    if (response.status === 'ERROR') {
      log.error('getOperationStatus', `Operation failed: ${operationHandle}`);
      
      // Look for error details in various possible locations
      if (response.errorMessage) {
        log.error('getOperationStatus', `Error: ${response.errorMessage}`);
      }
      if (response.exception) {
        log.error('getOperationStatus', 'Exception', response.exception);
      }
    } else if (response.status === 'FINISHED') {
      log.info('getOperationStatus', `Operation completed: ${operationHandle}`);
    }
    
    return response;
  }

  // Get operation results
  async getOperationResults(sessionHandle, operationHandle, token = 0, rowFormat = 'JSON') {
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}/operations/${operationHandle}/result/${token}?rowFormat=${rowFormat}`;
    
    const response = await this.request(endpoint);
    
    // Only log significant events, not every token fetch
    if (token === 0) {
      log.debug('fetchOperationResult', `Fetching results for operation`, { operationHandle });
    }
    
    // If there are errors in the results, log them
    if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
      log.error('fetchOperationResult', 'Errors in operation results', { 
        operationHandle,
        errors: response.errors 
      });
    }
    
    return response;
  }

  // Get detailed error information for a failed operation
  async getOperationError(sessionHandle, operationHandle) {
    try {
      // First try to get the status with error details
      const statusResponse = await this.getOperationStatus(sessionHandle, operationHandle);
      
      // Then try to get result with error details
      const resultResponse = await this.getOperationResults(sessionHandle, operationHandle, 0);
      
      const errorInfo = {
        status: statusResponse,
        result: resultResponse,
        extractedErrors: []
      };
      
      // Extract errors from various sources
      if (statusResponse.errorMessage) {
        errorInfo.extractedErrors.push({
          source: 'status.errorMessage',
          message: statusResponse.errorMessage
        });
      }
      
      if (statusResponse.exception) {
        errorInfo.extractedErrors.push({
          source: 'status.exception',
          details: statusResponse.exception
        });
      }
      
      if (resultResponse.errors) {
        errorInfo.extractedErrors.push({
          source: 'result.errors',
          errors: resultResponse.errors
        });
      }
      
      return errorInfo;
    } catch (error) {
      log.error('getDetailedErrorInfo', `Failed to get detailed error information: ${error.message}`, {
        error: error.stack,
        operationHandle
      });
      throw error;
    }
  }

  // Get all results for an operation (handles pagination)
  async getAllResults(sessionHandle, operationHandle) {
    log.debug('getAllResults', `Fetching all results for operation`, { operationHandle });
    const results = [];
    let nextToken = 0;
    let hasMore = true;
    let columns = [];
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (hasMore && attempts < maxAttempts) {
      attempts++;
      
      try {
        const response = await this.getOperationResults(sessionHandle, operationHandle, nextToken);
        
        // Extract and handle result metadata
        const resultType = response.resultType;
        const resultKind = response.resultKind;
        
        // Handle different column sources - prioritize columnInfos over columns
        if (response.results) {
          if (response.results.columnInfos && response.results.columnInfos.length > 0 && columns.length === 0) {
            columns = response.results.columnInfos;
            log.debug('getAllResults', `Found columns from columnInfos`, { columnCount: columns.length });
          } else if (response.results.columns && response.results.columns.length > 0 && columns.length === 0) {
            columns = response.results.columns;
            log.debug('getAllResults', `Found columns from columns`, { columnCount: columns.length });
          }
          
          // Handle result data - check multiple possible locations
          let dataToAdd = null;
          if (response.results.data && Array.isArray(response.results.data)) {
            dataToAdd = response.results.data;
          } else if (Array.isArray(response.results)) {
            dataToAdd = response.results;
          }
          
          if (dataToAdd && dataToAdd.length > 0) {
            results.push(...dataToAdd);
          }
        }

        // Check if there are more results
        if (response.nextResultUri) {
          // Extract token from nextResultUri
          const tokenMatch = response.nextResultUri.match(/result\/(\d+)/);
          if (tokenMatch) {
            const newToken = parseInt(tokenMatch[1]);
            if (newToken > nextToken) {
              nextToken = newToken;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }

        // Handle different result types
        if (response.resultType === 'EOS') {
          hasMore = false;
        } else if (response.resultType === 'NOT_READY') {
          // Continue to next iteration
        } else if (response.resultType === 'PAYLOAD') {
          // Continue based on nextResultUri presence
        }
        
        // Special handling for empty first response
        if (response.resultType === 'EOS' && 
            (!response.results || !response.results.data || response.results.data.length === 0) && 
            !response.nextResultUri && 
            nextToken === 0 && 
            attempts === 1) {
          nextToken = 1;
          hasMore = true;
        }
        
      } catch (error) {
        log.error('getAllResults', `Error fetching results`, { 
          nextToken, 
          error: error.message,
          operationHandle 
        });
        throw error; // Re-throw to maintain error propagation
      }
    }

    if (attempts >= maxAttempts) {
      log.warn('getAllResults', `Stopped after max attempts to prevent infinite loop`, { maxAttempts });
    }

    log.info('getAllResults', `Retrieved results`, { 
      rowCount: results.length, 
      columnCount: columns.length,
      operationHandle 
    });

    return { results, columns };
  }

  // Extract root cause from Java exception stack trace
  extractRootCause(errors) {
    if (!errors || !Array.isArray(errors)) return null;
    
    // Look for the error message that contains the full stack trace
    const stackTraceError = errors.find(error => 
      typeof error === 'string' && error.includes('Caused by:')
    );
    
    if (!stackTraceError) return null;
    
    // Split by "Caused by:" and get the last one
    const causedByParts = stackTraceError.split('Caused by:');
    if (causedByParts.length <= 1) return null;
    
    // Get the last "Caused by:" section
    const rootCauseSection = causedByParts[causedByParts.length - 1].trim();
    
    // Extract just the exception type and message (first line)
    const lines = rootCauseSection.split('\n');
    const rootCauseLine = lines[0].trim();
    
    // Clean up the root cause message
    if (rootCauseLine) {
      // Remove common Java exception prefixes to make it more readable
      const cleanMessage = rootCauseLine
        .replace(/^[a-zA-Z0-9.]+Exception:\s*/, '') // Remove exception class name
        .replace(/^[a-zA-Z0-9.]+Error:\s*/, '') // Remove error class name
        .trim();
      
      return cleanMessage || rootCauseLine;
    }
    
    return null;
  }

  // Helper method to analyze and log response structure (simplified for production)
  analyzeResultStructure(response, context = '') {
    // Only log basic structure for debugging if needed
    if (!response) return;
    
    // Only log in development or when explicitly debugging
    if (process.env.NODE_ENV === 'development') {
      log.debug('analyzeResultStructure', `${context}: ${response.resultType || 'unknown'} - ${Object.keys(response).length} keys`);
    }
  }
}

const flinkApiInstance = new FlinkApiService();
export default flinkApiInstance;
