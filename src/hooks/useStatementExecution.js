import { useState, useCallback, useEffect, useRef } from 'react';
import { statementManager } from '../services/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('useStatementExecution');

/**
 * Custom hook for managing statement execution with isolated state
 * Each component using this hook gets its own statement execution context
 */
export function useStatementExecution(componentName = 'unknown') {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const currentStatementIdRef = useRef(null);
  const observerRef = useRef(null);

  // Cleanup function to remove observer when component unmounts
  const cleanup = useCallback(() => {
    if (observerRef.current) {
      log.debug('cleanup', `Cleaning up observer`, { componentName });
      statementManager.removeGlobalObserver(observerRef.current);
      observerRef.current = null;
    }
    currentStatementIdRef.current = null;
  }, [componentName]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Execute SQL statement with isolated state management
  const executeSQL = useCallback(async (statement, options = {}) => {
    const { silent = false, statementId = null } = options;
    
    if (!statement?.trim()) {
      throw new Error('No SQL statement provided');
    }

    // For sequential executions (like batch), don't cleanup the previous observer
    // Instead, let each statement complete naturally
    log.info('executeStatement', `Starting new execution`, { 
      componentName, 
      isExecuting, 
      statementPreview: statement.substring(0, 100) 
    });

    // Generate unique statement ID for this component
    const newStatementId = statementId || `${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the previous statement ID for comparison
    const previousStatementId = currentStatementIdRef.current;
    currentStatementIdRef.current = newStatementId;

    setIsExecuting(true);
    setError(null);
    
    if (!silent) {
      setResult(null);
    }

    try {
      log.debug('executeStatement', `Executing statement`, { 
        componentName, 
        statementId: newStatementId,
        statementPreview: statement.substring(0, 100) 
      });

      // Add observer to the statement manager (only add once)
      const needsNewObserver = !observerRef.current;
      
      // Create observer for this specific statement (or update existing one)
      observerRef.current = (event) => {
        log.trace('observer', `Received event for statement ${event.statementId}`, { 
          componentName, 
          currentStatement: currentStatementIdRef.current, 
          previousStatement: previousStatementId,
          eventType: event.type
        });
        
        // Only process events for the current statement, ignore events from previous statements
        if (event.statementId === currentStatementIdRef.current) {
          log.debug('observer', `Processing statement update`, { 
            componentName, 
            eventType: event.type,
            eventDetails: event 
          });
          
          // Handle different event types
          let executionState = null;
          let results = [];
          let columns = [];
          let resultType = null;
          let resultKind = null;
          
          if (event.type === 'lifecycle') {
            // Lifecycle events from StatementManager
            if (event.eventType === 'statement_completed' && event.result && event.result.state) {
              executionState = event.result.state.statementExecutionState;
              results = event.result.state.results || [];
              columns = event.result.state.columns || [];
              resultType = event.result.state.resultType;
              resultKind = event.result.state.resultKind;
            } else {
              // Other lifecycle events (started, error, cancelled) - ignore for UI updates
              log.debug('observer', `Ignoring lifecycle event`, { 
                componentName, 
                eventType: event.eventType 
              });
              return;
            }
          } else if (event.type === 'statement_update' && event.state && event.state.statementExecutionState) {
            // Incremental state updates during execution - these contain real-time results
            executionState = event.state.statementExecutionState;
            results = event.state.results || [];
            columns = event.state.columns || [];
            resultType = event.state.resultType;
            resultKind = event.state.resultKind;
            log.debug('observer', `Processing incremental update`, {
              componentName,
              rowCount: results.length,
              columnCount: columns.length, 
              state: executionState,
              resultType,
              resultKind,
              hasResults: results.length > 0,
              hasColumns: columns.length > 0,
              firstRow: results[0] || 'none'
            });
          } else if (event.state && event.state.statementExecutionState) {
            // Direct execution state events from StatementExecutionEngine
            executionState = event.state.statementExecutionState;
            results = event.state.results || [];
            columns = event.state.columns || [];
            resultType = event.state.resultType;
            resultKind = event.state.resultKind;
          } else {
            // Unknown event type - ignore
            log.debug('observer', `Ignoring unknown event`, { 
              componentName, 
              eventType: event.type || 'unknown' 
            });
            return;
          }
          
          // Convert to legacy format for compatibility
          const legacyResult = {
            currentStatus: executionState === 'RUNNING' ? 'RUNNING' : 'COMPLETED',
            message: `Statement ${event.statementId}: ${executionState}`,
            content: {
              results: results,
              columns: columns,
              rowCount: results.length,
              columnCount: columns.length
            },
            resultType: resultType,
            resultKind: resultKind,
            status: executionState === 'RUNNING' ? 'RUNNING' : 'FINISHED',
            results: results,
            columns: columns,
            timestamp: event.timestamp,
            operationHandle: event.operationHandle,
            statementId: event.statementId,
            isExecuting: executionState === 'RUNNING'
          };

          // Update component state
          if (!silent) {
            log.debug('observer', `Updating ResultsDisplay`, {
              componentName,
              resultType: legacyResult.resultType,
              resultKind: legacyResult.resultKind,
              status: legacyResult.status,
              resultCount: legacyResult.results?.length || 0,
              columnCount: legacyResult.columns?.length || 0,
              isExecuting: legacyResult.isExecuting
            });
            setResult(legacyResult);
          }

          // Update execution state
          setIsExecuting(executionState === 'RUNNING');

          // If execution completed, only cleanup if this was the current statement
          if (executionState === 'STOPPED' && event.statementId === currentStatementIdRef.current) {
            log.info('observer', `Current statement completed`, { 
              componentName, 
              statementId: event.statementId 
            });
            setIsExecuting(false);
            // Cleanup after a short delay only for the current statement
            setTimeout(() => {
              if (currentStatementIdRef.current === event.statementId) {
                cleanup();
              }
            }, 1000);
          } else if (executionState === 'STOPPED') {
            log.debug('observer', `Previous statement completed (ignored)`, { 
              componentName, 
              statementId: event.statementId 
            });
          }
        }
      };

      // Add observer to the statement manager (only if we need a new one)
      if (needsNewObserver) {
        log.debug('executeStatement', `Adding new global observer`, { 
          componentName, 
          statementId: newStatementId 
        });
        statementManager.addGlobalObserver(observerRef.current);
      } else {
        log.debug('executeStatement', `Reusing existing observer`, { 
          componentName, 
          statementId: newStatementId 
        });
      }

      // Execute the statement
      const executionResult = await statementManager.executeSQL(statement, newStatementId);
      
      log.info('executeStatement', `Statement execution completed`, { 
        componentName, 
        result: executionResult 
      });
      
      return executionResult;

    } catch (err) {
      log.error('executeStatement', `Statement execution failed`, { 
        componentName, 
        error: err.message,
        stack: err.stack 
      });
      setError(err.message);
      setIsExecuting(false);
      cleanup();
      throw err;
    }
  }, [componentName, cleanup]);

  // Cancel current statement
  const cancelExecution = useCallback(async () => {
    if (currentStatementIdRef.current) {
      try {
        log.info('cancelExecution', `Cancelling statement`, { 
          componentName, 
          statementId: currentStatementIdRef.current 
        });
        await statementManager.cancelStatement(currentStatementIdRef.current);
        setIsExecuting(false);
        cleanup();
      } catch (err) {
        log.error('cancelExecution', `Failed to cancel statement`, { 
          componentName, 
          error: err.message,
          stack: err.stack 
        });
        setError(err.message);
      }
    }
  }, [componentName, cleanup]);

  // Get current statement info
  const getStatementInfo = useCallback(() => {
    if (currentStatementIdRef.current) {
      return statementManager.getStatementInfo(currentStatementIdRef.current);
    }
    return null;
  }, []);

  return {
    executeSQL,
    cancelExecution,
    getStatementInfo,
    isExecuting,
    result,
    error,
    currentStatementId: currentStatementIdRef.current
  };
}

export default useStatementExecution;
