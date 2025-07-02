class FlinkApiService {
  constructor(baseUrl = 'http://localhost:8083') {
    this.baseUrl = baseUrl;
    this.apiVersion = 'v1'; // Default to v1, will auto-detect
    this.useProxy = true; // Use proxy by default in development
  }

  setBaseUrl(url) {
    this.baseUrl = url;
    // If we're in development and using localhost, use proxy
    this.useProxy = window.location.hostname === 'localhost' && url.includes('localhost:8083');
  }

  getProxyUrl(endpoint) {
    if (this.useProxy) {
      return `/api/flink${endpoint}`;
    }
    return `${this.baseUrl}${endpoint}`;
  }

  async request(endpoint, options = {}) {
    const url = this.getProxyUrl(endpoint);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    console.log(`Making request to: ${url} ${this.useProxy ? '(via proxy)' : '(direct)'}`);
    console.log(`Request config:`, JSON.stringify(config, null, 2));

    try {
      const response = await fetch(url, config);
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Response data:`, JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('Flink API request failed:', error);
      
      // Check if it's a CORS error
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        console.error('  This looks like a CORS error. Make sure:');
        console.error('   1. Flink SQL Gateway is running on localhost:8083');
        console.error('   2. The Vite dev server proxy is working');
        console.error('   3. Try restarting the dev server');
      }
      
      throw error;
    }
  }

  // Get Flink info and auto-detect API version
  async getInfo() {
    try {
      // Try v1 first
      console.log('Trying v1 API...');
      const result = await this.request('/v1/info');
      this.apiVersion = 'v1';
      console.log('Using API v1');
      return result;
    } catch (error) {
      console.log('v1 failed, trying v2...');
      try {
        const result = await this.request('/v2/info');
        this.apiVersion = 'v2';
        console.log('Using API v2');
        return result;
      } catch (error2) {
        console.error('Both v1 and v2 failed');
        throw error2;
      }
    }
  }

  // Create a new session
  async createSession(properties = {}) {
    const endpoint = `/${this.apiVersion}/sessions`;
    console.log(`Creating session with endpoint: ${endpoint}`);
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(properties),
    });
  }

  // Get session info
  async getSession(sessionHandle) {
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}`;
    console.log(`Getting session with endpoint: ${endpoint}`);
    return this.request(endpoint);
  }

  // Close a session
  async closeSession(sessionHandle) {
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}`;
    console.log(`Closing session with endpoint: ${endpoint}`);
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Submit a SQL statement
  async submitStatement(sessionHandle, statement) {
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}/statements`;
    console.log(`Submitting statement with endpoint: ${endpoint}`);
    console.log(`Statement: ${statement}`);
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ statement }),
    });
  }

  // Get operation status
  async getOperationStatus(sessionHandle, operationHandle) {
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}/operations/${operationHandle}/status`;
    console.log(`Getting operation status with endpoint: ${endpoint}`);
    return this.request(endpoint);
  }

  // Get operation results
  async getOperationResults(sessionHandle, operationHandle, token = 0, rowFormat = 'JSON') {
    const endpoint = `/${this.apiVersion}/sessions/${sessionHandle}/operations/${operationHandle}/result/${token}?rowFormat=${rowFormat}`;
    console.log(`Getting operation results with endpoint: ${endpoint}`);
    return this.request(endpoint);
  }

  // Get all results for an operation (handles pagination)
  async getAllResults(sessionHandle, operationHandle) {
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
        
        console.log(`Raw result response for token ${nextToken} (attempt ${attempts}):`, JSON.stringify(response, null, 2));
        
        // Store columns from first response that has them
        if (response.results && response.results.columns && columns.length === 0) {
          columns = response.results.columns;
          console.log(`Columns detected:`, JSON.stringify(columns, null, 2));
        }
        
        if (response.results && response.results.data) {
          console.log(`Data chunk ${nextToken}:`, JSON.stringify(response.results.data, null, 2));
          results.push(...response.results.data);
        }

        // Check if there are more results
        if (response.nextResultUri) {
          // Extract token from nextResultUri
          const tokenMatch = response.nextResultUri.match(/result\/(\d+)/);
          if (tokenMatch) {
            nextToken = parseInt(tokenMatch[1]);
            console.log(`Next token: ${nextToken}`);
          } else {
            console.log(`Could not parse next token from: ${response.nextResultUri}`);
            hasMore = false;
          }
        } else {
          console.log(`No nextResultUri found`);
          hasMore = false;
        }

        // If resultType is EOS (End of Stream), we're done
        if (response.resultType === 'EOS') {
          console.log(`End of stream reached`);
          hasMore = false;
        }
        
        // Special case: if we got EOS but no data and no nextResultUri, 
        // try the next token anyway (sometimes Flink has weird pagination)
        if (response.resultType === 'EOS' && 
            (!response.results || !response.results.data || response.results.data.length === 0) && 
            !response.nextResultUri && 
            nextToken === 0) {
          console.log(`EOS with no data on first token, trying token 1...`);
          nextToken = 1;
          hasMore = true;
        }
        
      } catch (error) {
        console.error(`Error fetching results for token ${nextToken}:`, error);
        hasMore = false;
      }
    }

    if (attempts >= maxAttempts) {
      console.warn(`Stopped after ${maxAttempts} attempts to prevent infinite loop`);
    }

    console.log(`Final aggregated results:`, JSON.stringify({ columns, results, totalRows: results.length, attempts }, null, 2));
    return { results, columns };
  }
}

const flinkApiInstance = new FlinkApiService();
export default flinkApiInstance;
