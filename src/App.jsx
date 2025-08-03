import React, { useState, useEffect, useRef } from 'react';
import { Play, Settings, Database, Info, Bug, X, RefreshCw, Plus, PlayCircle, Square } from 'lucide-react';
import MosaicLayout from './layout/MosaicLayout.jsx';
import SettingsPanel from './components/SettingsPanel';
import ThemeButton from './components/ThemeButton';
import { flinkApi, statementManager, settingsService } from './services/index.js';
import themeService from './services/themeService.js';
import { useStatementExecution } from './hooks/useStatementExecution.js';
import { splitSqlStatements, getStatementType, formatStatementForDisplay } from './utils/sqlParser.js';
import logger, { LOG_LEVELS } from './utils/logger.js';

const log = logger.getModuleLogger('App');

const DEFAULT_QUERY = `-- Welcome to Flink SQL Editor
-- Example queries to get you started:

-- Create a table from values
CREATE TABLE sample_data (
  name STRING,
  age INT,
  city STRING
) WITH (
  'connector' = 'values',
  'data-id' = 'sample'
);

-- Insert some data
INSERT INTO sample_data VALUES
  ('Alice', 25, 'New York'),
  ('Bob', 30, 'San Francisco'),
  ('Charlie', 35, 'London');

-- Query the data
SELECT name, age, city FROM sample_data WHERE age > 25;`;

function App() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [history, setHistory] = useState([]);
  const [flinkInfo, setFlinkInfo] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false); // Track connection status
  
  // Batch execution state
  const [isBatchExecuting, setIsBatchExecuting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentStatement: '' });
  const [batchResults, setBatchResults] = useState([]);
  
  const [sessionInfo, setSessionInfo] = useState({
    sessionHandle: null,
    isActive: false,
    startTime: null,
    age: 0,
    properties: {}
  });
  
  // Ref to access SqlEditor methods
  const sqlEditorRef = useRef(null);

  // Main SQL execution hook for results panel
  const {
    executeSQL: executeMainSQL,
    isExecuting: isMainExecuting,
    result: mainResult,
    error: mainError,
    cancelExecution: cancelMainExecution
  } = useStatementExecution('MainSQLEditor');

  // Initialize logger and integrate with debug panel
  useEffect(() => {
    // Configure logger with current settings
    const settings = settingsService.getSettings();
    const levelMap = {
      'trace': LOG_LEVELS.TRACE,
      'debug': LOG_LEVELS.DEBUG,
      'info': LOG_LEVELS.INFO,
      'warn': LOG_LEVELS.WARN,
      'error': LOG_LEVELS.ERROR
    };

    logger.configure({
      level: levelMap[settings.logging?.level] || LOG_LEVELS.INFO,
      consoleLevel: levelMap[settings.logging?.consoleLevel] || LOG_LEVELS.WARN,
      panelLevel: levelMap[settings.logging?.panelLevel] || LOG_LEVELS.INFO,
      enableTraceInPanel: settings.logging?.enableTraceInPanel || false,
      modules: settings.logging?.modules || {}
    });

    // Add logger listener to update debug panel
    const logListener = (logEntry) => {
      if (logEntry.type === 'clear') {
        setDebugLogs([]);
      } else {
        setDebugLogs(prev => [...prev.slice(-299), logEntry]);
      }
    };

    logger.addListener(logListener);

    // Listen for settings changes to update logger configuration
    const settingsListener = (newSettings) => {
      logger.configure({
        level: levelMap[newSettings.logging?.level] || LOG_LEVELS.INFO,
        consoleLevel: levelMap[newSettings.logging?.consoleLevel] || LOG_LEVELS.WARN,
        panelLevel: levelMap[newSettings.logging?.panelLevel] || LOG_LEVELS.INFO,
        enableTraceInPanel: newSettings.logging?.enableTraceInPanel || false,
        modules: newSettings.logging?.modules || {}
      });
    };

    settingsService.addListener(settingsListener);

    return () => {
      logger.removeListener(logListener);
      settingsService.removeListener(settingsListener);
    };
  }, []);

  // Set up session manager listener
  useEffect(() => {
    // Initialize theme service
    themeService.loadSavedTheme();
    
    // Connect the logger to StatementManager
    statementManager.setDebugLogFunction((message, type = 'info') => {
      // Map the legacy type parameter to appropriate log levels
      switch (type) {
        case 'error':
          log.error('StatementManager', message);
          break;
        case 'warning':
        case 'warn':
          log.warn('StatementManager', message);
          break;
        case 'debug':
          log.debug('StatementManager', message);
          break;
        default:
          log.info('StatementManager', message);
      }
    });

    const handleSessionChange = (newSessionInfo) => {
      setSessionInfo(newSessionInfo);
    };

    statementManager.addSessionListener(handleSessionChange);
    
    // Initialize session info
    setSessionInfo(statementManager.getSessionInfo());

    return () => {
      statementManager.removeSessionListener(handleSessionChange);
      
      // Cleanup is handled automatically by StatementManager
    };
  }, []);

  // Listen for settings changes and update session properties
  useEffect(() => {
    const handleSettingsChange = (newSettings) => {
      statementManager.updateSessionProperties(newSettings.session.properties);
      
      // Update API base URL and credentials if gateway settings changed
      flinkApi.setBaseUrl(newSettings.gateway.url);
      flinkApi.setCredentials(
        newSettings.gateway.username,
        newSettings.gateway.password,
        newSettings.gateway.apiToken
      );
    };

    settingsService.addListener(handleSettingsChange);

    // Initialize with current settings
    const currentSettings = settingsService.getSettings();
    flinkApi.setBaseUrl(currentSettings.gateway.url);
    flinkApi.setCredentials(
      currentSettings.gateway.username,
      currentSettings.gateway.password,
      currentSettings.gateway.apiToken
    );
    
    // Log environment variable status for debugging
    settingsService.getEnvironmentStatus();
    
    // Auto-connect on app load
    log.info('useEffect', 'Auto-connecting to Flink gateway on app load...');
    testConnection().catch(error => {
      log.warn('useEffect', `Auto-connect failed on app load: ${error.message}`);
      // Don't throw error - app should still work even if connection fails
    });

    return () => {
      settingsService.removeListener(handleSettingsChange);
    };
  }, []);

  // Update session age every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionInfo.isActive) {
        setSessionInfo(prev => ({
          ...prev,
          age: prev.startTime ? Date.now() - prev.startTime : 0
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionInfo.isActive, sessionInfo.startTime]);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('flink-sql-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (error) {
        log.error('useEffect', `Failed to load history: ${error.message}`);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('flink-sql-history', JSON.stringify(history));
  }, [history]);

  // Session management functions
  const handleRefreshSession = async () => {
    log.traceEnter('handleRefreshSession');
    
    try {
      await statementManager.refreshSession();
      log.info('handleRefreshSession', 'Session refreshed successfully');
    } catch (error) {
      log.error('handleRefreshSession', `Failed to refresh session: ${error.message}`);
    }
    
    log.traceExit('handleRefreshSession');
  };

  const handleCloseSession = async () => {
    log.traceEnter('handleCloseSession');
    
    try {
      await statementManager.closeSession();
      log.info('handleCloseSession', 'Session closed successfully');
    } catch (error) {
      log.error('handleCloseSession', `Failed to close session: ${error.message}`);
    }
    
    log.traceExit('handleCloseSession');
  };

  const handleNewSession = async () => {
    log.traceEnter('handleNewSession');
    
    try {
      log.info('handleNewSession', 'Starting new session...');
      await statementManager.refreshSession(); // This closes current and creates new
      log.info('handleNewSession', 'New session started successfully');
    } catch (error) {
      log.error('handleNewSession', `Failed to start new session: ${error.message}`);
    }
    
    log.traceExit('handleNewSession');
  };

  // Test connection and get Flink info
  const testConnection = async (direct = false) => {
    log.traceEnter('testConnection', { direct });
    log.info('testConnection', `Testing connection ${direct ? 'DIRECT' : 'via PROXY'}...`);
    setIsConnecting(true);
    
    try {
      const originalUseProxy = flinkApi.useProxy;
      if (direct) {
        flinkApi.useProxy = false;
      }
      
      // Get current settings and set URL + credentials
      const currentSettings = settingsService.getSettings();
      flinkApi.setBaseUrl(currentSettings.gateway.url);
      flinkApi.setCredentials(
        currentSettings.gateway.username,
        currentSettings.gateway.password,
        currentSettings.gateway.apiToken
      );
      
      const info = await flinkApi.getInfo();
      setFlinkInfo(info);
      
      flinkApi.useProxy = originalUseProxy;
      return true;
    } catch (error) {
      log.error('testConnection', `Connection test failed: ${error.message}`, { 
        error: error.stack,
        bypassProxy 
      });
      setFlinkInfo(null);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Test both proxy and direct connections
  const testBothConnections = async () => {
    log.info('testBothConnections', 'Testing both proxy and direct connections...');
    
    const proxyResult = await testConnection(false);
    log.info('testBothConnections', `Proxy connection result`, { success: proxyResult });
    
    const directResult = await testConnection(true);
    log.info('testBothConnections', `Direct connection result`, { success: directResult });
    
    if (!proxyResult && directResult) {
      log.info('testBothConnections', 'Direct works but proxy fails - this is a proxy configuration issue');
    } else if (proxyResult && !directResult) {
      log.info('testBothConnections', 'Proxy works but direct fails - this is expected due to CORS');
    } else if (!proxyResult && !directResult) {
      log.warn('testBothConnections', 'Both failed - check if Flink SQL Gateway is running');
    }
  };

  const executeSelectedQuery = async () => {
    log.debug('executeSelectedQuery', 'Single Execute button clicked');
    
    if (!sqlEditorRef.current) {
      // Fallback to full query if ref not available
      log.debug('executeSelectedQuery', 'No sqlEditorRef, using full query');
      return executeQuery();
    }
    
    const queryToExecute = sqlEditorRef.current.getQueryToExecute();
    log.debug('executeSelectedQuery', 'Execute button clicked', { 
      queryPreview: queryToExecute.substring(0, 100) + (queryToExecute.length > 100 ? '...' : ''),
      queryLength: queryToExecute.length 
    });
    
    return executeQuery(queryToExecute);
  };

  const executeQuery = async (customQuery = null) => {
    const queryToExecute = customQuery || query.trim();
    
    log.debug('executeQuery', 'Entry point called', { 
      queryPreview: queryToExecute?.substring(0, 50) + (queryToExecute?.length > 50 ? '...' : ''),
      queryLength: queryToExecute?.length 
    });
    log.debug('executeQuery', 'Hook state', { 
      isMainExecuting, 
      isBatchExecuting, 
      executeMainSQLType: typeof executeMainSQL 
    });
    
    if (!queryToExecute || isMainExecuting) {
      log.warn('executeQuery', 'Query execution blocked', { 
        hasQuery: !!queryToExecute, 
        isMainExecuting 
      });
      return;
    }

    log.info('executeQuery', 'Starting execution', { 
      queryPreview: queryToExecute.length > 50 ? queryToExecute.substring(0, 50) + '...' : queryToExecute,
      queryLength: queryToExecute.length 
    });
    log.debug('executeQuery', 'Using executeMainSQL hook for execution');
    
    const executionId = Date.now();
    const execution = {
      id: executionId,
      query: queryToExecute,
      timestamp: Date.now(),
      status: 'RUNNING'
    };

    // Add to history immediately
    setHistory(prev => [execution, ...prev.slice(0, 49)]); // Keep last 50 executions

    try {
      // Set Flink API base URL from settings
      const gatewayUrl = settingsService.getGatewayUrl();
      flinkApi.setBaseUrl(gatewayUrl);
      
      // Execute using the statement execution hook
      log.debug('executeQuery', 'Calling executeMainSQL', { 
        queryPreview: queryToExecute.substring(0, 100),
        queryLength: queryToExecute.length 
      });
      const result = await executeMainSQL(queryToExecute, { silent: false });
      log.debug('executeQuery', 'executeMainSQL returned', { 
        resultStatus: result?.status,
        hasResult: !!result 
      });
      
      // Update history with result
      setHistory(prev => prev.map(h => 
        h.id === executionId 
          ? { ...h, ...result, status: result.status }
          : h
      ));

      return result;

    } catch (error) {
      log.error('executeQuery', 'Query execution failed', { 
        error: error.message,
        stack: error.stack,
        queryPreview: queryToExecute.substring(0, 100) 
      });
      
      const errorResult = {
        status: 'ERROR',
        error: error.message,
        errorDetails: {
          message: error.message,
          type: error.name || 'Unknown',
          timestamp: new Date().toISOString(),
          stack: error.stack,
          query: queryToExecute.substring(0, 200) + (queryToExecute.length > 200 ? '...' : '')
        },
        results: [],
        columns: []
      };
      
      // Update history with error
      setHistory(prev => prev.map(h => 
        h.id === executionId 
          ? { ...h, ...errorResult, status: 'ERROR' }
          : h
      ));
      
      throw error;
    }
  };

  // Stop current execution
  const stopExecution = async () => {
    try {
      log.info('stopExecution', 'Stop button clicked - cancelling execution');
      
      // Get current result for operation handle
      const currentResult = mainResult;
      const operationHandle = currentResult?.operationHandle;
      const sessionHandle = currentResult?.sessionHandle;
      
      // Update UI immediately to show we're stopping
      // We don't set isExecuting=false here anymore as this will be handled by observer
      // This allows the UI to properly show the final CANCELLED state
      setIsBatchExecuting(false);
      
      // Log cancellation details
      log.debug('stopExecution', 'Cancellation details', { 
        operationHandle: operationHandle || 'N/A', 
        sessionHandle: sessionHandle || 'N/A' 
      });
      
      // If we have an operation handle, try to cancel it on the server
      if (operationHandle) {
        log.debug('stopExecution', 'Attempting to cancel operation on server', { operationHandle });
        
        try {
          // Use the dedicated cancelOperation method
          const cancelResult = await statementManager.cancelOperation(operationHandle);
          log.debug('stopExecution', 'Server cancellation result', { cancelResult });
        } catch (cancelError) {
          log.warn('stopExecution', 'Server cancellation error', { 
            error: cancelError.message,
            stack: cancelError.stack 
          });
          // The observer will still be notified by SessionManager
        }
      } else {
        // Otherwise, just set the flag
        log.debug('stopExecution', 'No operation handle available - cancelling all active statements');
        await statementManager.cancelAllStatements();
        
        // Cancel the main execution through the hook
        if (cancelMainExecution) {
          cancelMainExecution();
        }
      }
      
      log.info('stopExecution', 'Execution stop requested successfully');
    } catch (error) {
      log.error('stopExecution', 'Failed to stop execution', { 
        error: error.message,
        stack: error.stack 
      });
      // Cancellation is handled internally by StatementManager
      if (cancelMainExecution) {
        cancelMainExecution();
      }
    }
  };

  // Execute all statements in the editor one by one
  const executeBatchQueries = async () => {
    log.debug('executeBatchQueries', 'Execute All button clicked');
    log.info('executeBatchQueries', 'NOTICE: Batch execution uses History tab, single Execute uses Results panel');
    
    if (!sqlEditorRef.current || isBatchExecuting) return;
    
    const fullQuery = sqlEditorRef.current.getQueryToExecute();
    const statements = splitSqlStatements(fullQuery);
    
    if (statements.length === 0) {
      log.warn('executeBatchQueries', 'No SQL statements found to execute');
      return;
    }
    
    if (statements.length === 1) {
      log.info('executeBatchQueries', 'Only one statement found, executing normally');
      return executeQuery(statements[0]);
    }
    
    log.info('executeBatchQueries', `Starting batch execution of ${statements.length} statements`);
    
    setIsBatchExecuting(true);
    setBatchProgress({ current: 0, total: statements.length, currentStatement: '' });
    setBatchResults([]);
    
    const batchId = Date.now();
    const batchExecution = {
      id: batchId,
      query: `Batch execution (${statements.length} statements)`,
      timestamp: Date.now(),
      status: 'RUNNING',
      isBatch: true,
      statements: statements.map(stmt => formatStatementForDisplay(stmt))
    };
    
    // Add batch to history
    setHistory(prev => [batchExecution, ...prev.slice(0, 49)]);
    
    const results = [];
    let hasErrors = false;
    
    try {
      // Set Flink API base URL from settings
      const gatewayUrl = settingsService.getGatewayUrl();
      flinkApi.setBaseUrl(gatewayUrl);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const statementType = getStatementType(statement);
        const displayStatement = formatStatementForDisplay(statement, 80);
        
        log.info('executeBatchQueries', `Executing statement ${i + 1}/${statements.length} (${statementType}): ${displayStatement}`);
        
        setBatchProgress({
          current: i + 1,
          total: statements.length,
          currentStatement: displayStatement
        });
        
        try {
          // Use the same execution path as single Execute - this ensures Results panel updates
          const result = await executeMainSQL(statement, { silent: false });
          
          results.push({
            index: i + 1,
            statement: displayStatement,
            fullStatement: statement,
            type: statementType,
            status: result.status,
            result: result,
            timestamp: Date.now()
          });
          
          log.info('executeBatchQuery', `Statement ${i + 1} completed`, { 
            statementIndex: i + 1, 
            status: result.status,
            statementPreview: displayStatement 
          });
          
          // Check if the Flink API returned an error status and stop batch execution
          if (result.status === 'ERROR' || result.status === 'FAILED') {
            hasErrors = true;
            log.error('executeBatchQuery', `Stopping batch execution due to Flink API error in statement ${i + 1}`, {
              status: result.status,
              error: result.error
            });
            break;
          }
          
        } catch (error) {
          log.error('executeBatchQuery', `Statement ${i + 1} failed`, { 
            statementIndex: i + 1, 
            error: error.message,
            statementPreview: displayStatement,
            stack: error.stack 
          });
          hasErrors = true;
          
          const errorResult = {
            status: 'ERROR',
            error: error.message,
            results: [],
            columns: []
          };
          
          results.push({
            index: i + 1,
            statement: displayStatement,
            fullStatement: statement,
            type: statementType,
            status: 'ERROR',
            result: errorResult,
            error: error.message,
            timestamp: Date.now()
          });
          
          // Stop batch execution on first error
          log.error('executeBatchQuery', `Stopping batch execution due to error in statement ${i + 1}. Remaining statements: ${statements.length - i - 1}`);
          break;
        }
        
        // Small delay between statements to avoid overwhelming the system
        if (i < statements.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      log.info('executeBatchQuery', `Batch execution loop completed. Processed ${results.length} of ${statements.length} statements. HasErrors: ${hasErrors}`);
      
      setBatchResults(results);
      
      const finalStatus = hasErrors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      log.info('executeBatchQuery', `Batch execution ${finalStatus.toLowerCase()}`, { 
        totalStatements: results.length,
        hasErrors,
        finalStatus 
      });
      
      // Update batch execution in history
      setHistory(prev => prev.map(h => 
        h.id === batchId 
          ? { 
              ...h, 
              status: finalStatus,
              results: results,
              completedAt: Date.now(),
              duration: Date.now() - h.timestamp,
              successCount: results.filter(r => r.status === 'FINISHED').length,
              errorCount: results.filter(r => r.status === 'ERROR').length
            }
          : h
      ));
      
      return { status: finalStatus, batchResults: results };
      
    } catch (error) {
      log.error('executeBatchQuery', `Batch execution failed: ${error.message}`, { 
        error: error.stack,
        statementCount: statements?.length || 0 
      });
      
      const errorResult = {
        status: 'ERROR',
        error: error.message,
        results: [],
        columns: []
      };
      
      setResult(errorResult);
      
      // Update batch execution in history with error
      setHistory(prev => prev.map(h => 
        h.id === batchId 
          ? { ...h, status: 'ERROR', error: error.message }
          : h
      ));
      
      return errorResult;
      
    } finally {
      setIsBatchExecuting(false);
      setBatchProgress({ current: 0, total: 0, currentStatement: '' });
    }
  };

  // Execute query for sidebar (silent - doesn't update main UI)
  const handleSelectExecution = (execution) => {
    setQuery(execution.query);
    // Re-execute the query to show the results
    executeQuery(execution.query);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('flink-sql-history');
  };

  const handleClearDebugLogs = () => {
    setDebugLogs([]);
    log.info('handleClearDebugLogs', 'Debug logs cleared by user');
  };

  const handleSnippetInsert = (snippetSql) => {
    if (sqlEditorRef.current) {
      // Insert snippet at current cursor position or replace selection
      sqlEditorRef.current.insertSnippet(snippetSql);
    } else {
      // Fallback: append to current query
      setQuery(prev => prev + '\n\n' + snippetSql);
    }
  };

  return (
    <div className="app-layout">
      <header className="header">
        <div className="header-left">
          <Database className="w-8 h-8 text-blue-500 flex-shrink-0" />
          <div className="header-title-section">
            <h1>Flink SQL Editor</h1>
            <p className="header-subtitle">Interactive query editor for Apache Flink</p>
            <p className="header-user">@Avichay Marciano</p>
          </div>
        </div>
        
        <div className="header-right">
          {isConnecting && (
            <div className="connection-status connecting">
              <div className="connection-dot connecting"></div>
              Connecting to Flink Gateway...
            </div>
          )}
          {!isConnecting && flinkInfo && (
            <div className="connection-status connected">
              <div className="connection-dot connected"></div>
              Connected to {flinkInfo.productName} {flinkInfo.version}
            </div>
          )}
          {!isConnecting && !flinkInfo && (
            <div className="connection-status disconnected">
              <div className="connection-dot disconnected"></div>
              Not connected
            </div>
          )}
          
          {/* Session Controls */}
          <div className="header-controls-group">
            <button
              onClick={handleNewSession}
              className="btn-success btn-compact"
              title="Start New Session (closes current session)"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
            {sessionInfo.isActive && (
              <>
                <button
                  onClick={handleRefreshSession}
                  className="btn-primary btn-compact"
                  title="Refresh Session"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={handleCloseSession}
                  className="btn-danger btn-compact"
                  title="Close Session"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </>
            )}
          </div>
          
          {/* App Controls */}
          <div className="header-controls-group">
            <ThemeButton />
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn-secondary"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="app-content">
        <SettingsPanel
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
          onTestConnection={testConnection}
        />

        <MosaicLayout
          // Editor props
          sqlEditorRef={sqlEditorRef}
          query={query}
          setQuery={setQuery}
          executeSelectedQuery={executeSelectedQuery}
          executeBatchQueries={executeBatchQueries}
          stopExecution={stopExecution}
          isMainExecuting={isMainExecuting}
          isBatchExecuting={isBatchExecuting}
          batchProgress={batchProgress}
          
          // Results and History props
          mainResult={mainResult}
          history={history}
          handleSelectExecution={handleSelectExecution}
          handleClearHistory={handleClearHistory}
          
          // Session and catalog props
          sessionInfo={sessionInfo}
          handleSnippetInsert={handleSnippetInsert}
          
          // Debug logs
          debugLogs={debugLogs}
          handleClearDebugLogs={handleClearDebugLogs}
        />
      </div>
    </div>
  );
}

export default App;
