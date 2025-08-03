import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('StatementExecutionEngine');

/**
 * StatementExecutionEngine - Manages individual SQL statement execution
 * Handles statement submission, polling, cancellation, and result management
 * Allows concurrent execution of multiple statements
 */
class StatementExecutionEngine {
  constructor(sessionManager, flinkApi, statementId = null) {
    this.sessionManager = sessionManager;
    this.flinkApi = flinkApi;
    this.statementId = statementId || this.generateStatementId();
    this.operationHandle = null;
    this.cancelled = false;
    this.debugLogFunction = null;
    
    // State structure as requested
    this.state = {
      statementExecutionState: 'STOPPED',  // STOPPED, RUNNING
      resultType: 'EOS',                   // Last resultType received
      resultKind: 'SUCCESS',               // Last resultKind received  
      results: [],                         // All received rows
      columns: [],                         // Column metadata
      lastUpdateTime: null                 // Last update timestamp
    };
    
    this.observers = new Set(); // Observers for this specific statement
    this.currentPollingLoop = null; // Track current polling promise
  }

  // Generate a unique statement ID
  generateStatementId() {
    return `stmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Set debug logging function
  setDebugLogFunction(logFunction) {
    this.debugLogFunction = logFunction;
  }

  // Simple logging function
  log(message, type = 'info') {
    const prefixedMessage = `[${this.statementId}] ${message}`;
    if (this.debugLogFunction) {
      this.debugLogFunction(prefixedMessage, type);
    } else {
      log.info('log', message, { statementId: this.statementId });
    }
  }

  // Add observer for this statement's results
  addObserver(observer) {
    this.observers.add(observer);
    this.log(`Added observer, total: ${this.observers.size}`);
    
    // Send current state immediately
    if (this.state.results.length > 0 || this.state.statementExecutionState === 'RUNNING') {
      try {
        observer(this.createNotificationState());
      } catch (error) {
        this.log(`Error notifying new observer: ${error.message}`, 'error');
      }
    }
  }

  // Remove observer
  removeObserver(observer) {
    this.observers.delete(observer);
    this.log(`Removed observer, remaining: ${this.observers.size}`);
  }

  // Create state object for notifications
  createNotificationState() {
    return {
      statementId: this.statementId,
      operationHandle: this.operationHandle,
      state: { ...this.state },
      timestamp: Date.now()
    };
  }

  // Notify all observers
  notifyObservers() {
    const notificationState = this.createNotificationState();
    this.observers.forEach(observer => {
      try {
        observer(notificationState);
      } catch (error) {
        this.log(`Error in observer: ${error.message}`, 'error');
      }
    });
  }

  // Update internal state and notify observers
  updateState(updates) {
    const hasChanges = Object.keys(updates).some(key => 
      JSON.stringify(this.state[key]) !== JSON.stringify(updates[key])
    );
    
    if (hasChanges) {
      Object.assign(this.state, updates);
      this.state.lastUpdateTime = Date.now();
      this.notifyObservers();
    }
  }

  // Helper method to compare two rows for equality (used in UPDATE_BEFORE and DELETE operations)
  rowsMatch(row1, row2) {
    // Simple deep comparison of all properties
    const keys1 = Object.keys(row1).sort();
    const keys2 = Object.keys(row2).sort();
    
    // Check if they have the same number of properties
    if (keys1.length !== keys2.length) {
      return false;
    }
    
    // Check if all keys match
    if (!keys1.every((key, index) => key === keys2[index])) {
      return false;
    }
    
    // Check if all values match
    return keys1.every(key => {
      const val1 = row1[key];
      const val2 = row2[key];
      
      // Handle null/undefined comparison
      if (val1 === null && val2 === null) return true;
      if (val1 === undefined && val2 === undefined) return true;
      if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return false;
      
      // For primitive values, use strict equality
      if (typeof val1 !== 'object' && typeof val2 !== 'object') {
        return val1 === val2;
      }
      
      // For objects, use JSON comparison (simple but effective for this use case)
      try {
        return JSON.stringify(val1) === JSON.stringify(val2);
      } catch (error) {
        // Fallback to reference equality if JSON serialization fails
        return val1 === val2;
      }
    });
  }

  // Execute SQL statement
  async executeSQL(statement) {
    this.log(`🚀 Starting execution: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
    
    // Reset state for new execution
    this.cancelled = false;
    this.operationHandle = null;
    this.updateState({
      statementExecutionState: 'RUNNING',
      resultType: 'EOS',
      resultKind: 'SUCCESS',
      results: [],
      columns: []
    });

    try {
      // Get session from session manager
      const session = await this.sessionManager.getSession();
      
      // Validate session
      const isValid = await this.sessionManager.validateSession();
      if (!isValid) {
        this.log('Session invalid, creating new one...');
        await this.sessionManager.createSession();
      }

      // Submit statement
      this.log('Submitting statement...');
      const operationResponse = await this.flinkApi.submitStatement(session.sessionHandle, statement);
      this.operationHandle = operationResponse.operationHandle;
      this.log(`Operation submitted with handle: ${this.operationHandle}`);

      // Start polling loop
      this.currentPollingLoop = this.pollForResults(session.sessionHandle);
      const result = await this.currentPollingLoop;
      
      return result;

    } catch (error) {
      this.log(`❌ Execution failed: ${error.message}`);
      
      this.updateState({
        statementExecutionState: 'STOPPED',
        resultType: 'ERROR',
        resultKind: 'ERROR'
      });
      
      throw error;
    }
  }

  // Polling loop for results
  async pollForResults(sessionHandle) {
    let nextToken = 0;
    let loopCount = 0;
    const maxLoops = 1000;
    let shouldContinue = true;

    while (shouldContinue && loopCount < maxLoops && !this.cancelled) {
      loopCount++;
      this.log(`📡 Polling attempt ${loopCount}/${maxLoops} with token ${nextToken}`);
      
      if (this.cancelled) {
        this.log('⚠️ Operation cancelled - stopping polling');
        break;
      }

      try {
        const response = await this.flinkApi.getOperationResults(sessionHandle, this.operationHandle, nextToken);
        
        if (this.cancelled) {
          this.log('⚠️ Operation cancelled during API call - stopping');
          break;
        }
        
        // Update state with response data
        const stateUpdates = {
          resultType: response.resultType,
          resultKind: response.resultKind
        };

        // Handle columns (only set once)
        if (response.results && !this.state.columns.length) {
          const columns = response.results.columns || response.results.columnInfos || [];
          if (columns.length > 0) {
            stateUpdates.columns = [...columns];
            this.log(`Found ${columns.length} columns`);
          }
        }

        // Handle data for SUCCESS_WITH_CONTENT
        if (response.resultKind === 'SUCCESS_WITH_CONTENT' && response.results?.data && !this.cancelled) {
          const newRows = response.results.data;
          if (newRows.length > 0) {
            this.log(`Processing ${newRows.length} change events`);
            
            // Apply changelog operations to the current result set
            let updatedResults = [...this.state.results];
            let insertCount = 0;
            let updateCount = 0;
            let deleteCount = 0;
            
            for (const row of newRows) {
              if (this.cancelled) break;
              
              if (row.fields && Array.isArray(row.fields)) {
                // Convert fields to row object
                const rowObject = {};
                if (this.state.columns.length > 0) {
                  row.fields.forEach((value, index) => {
                    const columnName = this.state.columns[index]?.name || `column_${index}`;
                    rowObject[columnName] = value;
                  });
                } else {
                  row.fields.forEach((value, index) => {
                    rowObject[`field_${index}`] = value;
                  });
                }
                
                // Apply the change operation based on the 'kind' field
                switch (row.kind) {
                  case 'INSERT':
                    // Add new row
                    updatedResults.push(rowObject);
                    insertCount++;
                    break;
                    
                  case 'UPDATE_BEFORE':
                    // Remove the old version of the row
                    // Find and remove the matching row based on all field values
                    const beforeIndex = updatedResults.findIndex(existingRow => 
                      this.rowsMatch(existingRow, rowObject)
                    );
                    if (beforeIndex !== -1) {
                      updatedResults.splice(beforeIndex, 1);
                      this.log(`Removed UPDATE_BEFORE row at index ${beforeIndex}`);
                    } else {
                      this.log(`Warning: UPDATE_BEFORE row not found for removal`, 'warn');
                    }
                    break;
                    
                  case 'UPDATE_AFTER':
                    // Add the new version of the row
                    updatedResults.push(rowObject);
                    updateCount++;
                    break;
                    
                  case 'DELETE':
                    // Remove the row
                    const deleteIndex = updatedResults.findIndex(existingRow => 
                      this.rowsMatch(existingRow, rowObject)
                    );
                    if (deleteIndex !== -1) {
                      updatedResults.splice(deleteIndex, 1);
                      deleteCount++;
                      this.log(`Deleted row at index ${deleteIndex}`);
                    } else {
                      this.log(`Warning: DELETE row not found for removal`, 'warn');
                    }
                    break;
                    
                  default:
                    // For backward compatibility, treat unknown kinds as INSERT
                    this.log(`Unknown row kind: ${row.kind}, treating as INSERT`, 'warn');
                    updatedResults.push(rowObject);
                    insertCount++;
                    break;
                }
              }
            }
            
            if (this.cancelled) {
              this.log('⚠️ Operation cancelled during row processing');
              break;
            }
            
            // Update results with the new state
            stateUpdates.results = updatedResults;
            this.log(`Changelog applied: +${insertCount} inserts, ~${updateCount} updates, -${deleteCount} deletes (total: ${updatedResults.length} rows)`);
          }
        }

        // Update state with all changes
        this.updateState(stateUpdates);

        // Check if we should continue
        if (response.resultType === 'EOS') {
          this.log('Received EOS - stopping');
          shouldContinue = false;
        } else if (response.nextResultUri) {
          const tokenMatch = response.nextResultUri.match(/result\/(\d+)/);
          if (tokenMatch) {
            nextToken = parseInt(tokenMatch[1]);
            this.log(`More results available, continuing with token ${nextToken}...`);
            
            // Sleep with cancellation check
            if (!this.cancelled) {
              await this.sleepWithCancellationCheck(1000); // 1 second
            }
          } else {
            this.log('Could not parse nextResultUri, stopping');
            shouldContinue = false;
          }
        } else {
          this.log('No more results available');
          shouldContinue = false;
        }

      } catch (error) {
        this.log(`❌ Polling error: ${error.message}`);
        
        // Update state to ERROR and re-throw the error so it propagates to batch execution
        this.updateState({
          statementExecutionState: 'STOPPED',
          resultType: 'ERROR',
          resultKind: 'ERROR'
        });
        
        throw error; // Re-throw so batch execution can catch it and stop
      }
    }

    // Handle final state
    if (this.cancelled) {
      this.log('⚠️ Operation was cancelled');
      
      // Try to cancel on server
      if (this.operationHandle) {
        try {
          await this.flinkApi.cancelOperation(sessionHandle, this.operationHandle)
            .catch(err => this.log(`Server cancellation failed: ${err.message}`));
        } catch (e) {
          // Ignore errors
        }
      }
      
      this.updateState({
        statementExecutionState: 'STOPPED',
        resultType: 'CANCELLED',
        resultKind: 'CANCELLED'
      });
      
      return {
        status: 'CANCELLED',
        message: 'Statement execution was cancelled',
        statementId: this.statementId,
        state: { ...this.state }
      };
    }

    if (loopCount >= maxLoops) {
      this.log('⚠️ Maximum polling attempts reached');
    }

    // Final completion state
    this.updateState({
      statementExecutionState: 'STOPPED'
    });

    this.log(`✅ Execution completed: ${this.state.results.length} rows, ${this.state.columns.length} columns`);
    
    return {
      status: 'COMPLETED',
      message: `Statement completed. Type: ${this.state.resultType}, Kind: ${this.state.resultKind}`,
      statementId: this.statementId,
      state: { ...this.state }
    };
  }

  // Sleep with periodic cancellation checks
  async sleepWithCancellationCheck(milliseconds) {
    const sleepStartTime = Date.now();
    while (Date.now() - sleepStartTime < milliseconds && !this.cancelled) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms chunks
    }
  }

  // Cancel the current operation
  async cancel() {
    this.log('🛑 Cancelling statement execution');
    this.cancelled = true;
    
    // If we have an active polling loop, let it handle the cancellation
    if (this.currentPollingLoop) {
      try {
        await this.currentPollingLoop;
      } catch (error) {
        // Ignore errors from cancelled operations
      }
    }
    
    return { success: true, message: 'Statement execution cancelled' };
  }

  // Get current state
  getState() {
    return {
      statementId: this.statementId,
      operationHandle: this.operationHandle,
      cancelled: this.cancelled,
      state: { ...this.state }
    };
  }

  // Check if statement is currently running
  isRunning() {
    return this.state.statementExecutionState === 'RUNNING';
  }

  // Check if statement was cancelled
  isCancelled() {
    return this.cancelled;
  }
}

export default StatementExecutionEngine;
