import SessionManager from './sessionManager.js';
import StatementExecutionEngine from './statementExecutionEngine.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('StatementManager');

/**
 * StatementManager - Orchestrates session management and statement execution
 * Allows concurrent execution of multiple statements using the same session
 */
class StatementManager {
  constructor(flinkApi) {
    this.flinkApi = flinkApi;
    this.sessionManager = SessionManager.getInstance(flinkApi); // Use singleton
    this.activeStatements = new Map(); // statementId -> StatementExecutionEngine
    this.debugLogFunction = null;
    this.globalObservers = new Set(); // Observers for all statement events
  }

  // Set debug logging function
  setDebugLogFunction(logFunction) {
    this.debugLogFunction = logFunction;
    this.sessionManager.setDebugLogFunction(logFunction);
  }

  // Simple logging function
  log(message, type = 'info') {
    const prefixedMessage = `[StatementManager] ${message}`;
    if (this.debugLogFunction) {
      this.debugLogFunction(prefixedMessage, type);
    } else {
      log.info('log', message);
    }
  }

  // Add global observer for all statement events
  addGlobalObserver(observer) {
    this.globalObservers.add(observer);
    this.log(`Added global observer, total: ${this.globalObservers.size}`);
  }

  // Remove global observer
  removeGlobalObserver(observer) {
    this.globalObservers.delete(observer);
    this.log(`Removed global observer, remaining: ${this.globalObservers.size}`);
  }

  // Notify global observers
  notifyGlobalObservers(event) {
    this.globalObservers.forEach(observer => {
      try {
        // Validate event structure before passing to observer
        if (!event) {
          this.log(`Warning: Null event passed to observer`, 'warning');
          return;
        }
        
        // Handle lifecycle events (type: 'lifecycle')
        if (event.type === 'lifecycle') {
          if (!event.eventType || !event.statementId) {
            this.log(`Warning: Invalid lifecycle event structure: ${JSON.stringify(event)}`, 'warning');
            return;
          }
        }
        // Handle state events (type: 'state')
        else if (event.type === 'state') {
          if (!event.state || !event.state.statementExecutionState) {
            this.log(`Warning: Invalid state event structure: ${JSON.stringify(event)}`, 'warning');
            return;
          }
        }
        // Handle legacy events (no type field)
        else if (!event.state) {
          this.log(`Warning: Unknown event structure: ${JSON.stringify(event)}`, 'warning');
          return;
        }
        
        observer(event);
      } catch (error) {
        this.log(`Error in global observer: ${error.message}`, 'error');
        this.log(`Event that caused error: ${JSON.stringify(event)}`, 'error');
      }
    });
  }

  // Session management methods (delegated to SessionManager)
  addSessionListener(callback) {
    return this.sessionManager.addListener(callback);
  }

  removeSessionListener(callback) {
    return this.sessionManager.removeListener(callback);
  }

  getSessionInfo() {
    return this.sessionManager.getSessionInfo();
  }

  updateSessionProperties(newProperties) {
    return this.sessionManager.updateSessionProperties(newProperties);
  }

  async createSession(customProperties = {}) {
    return this.sessionManager.createSession(customProperties);
  }

  async getSession() {
    return this.sessionManager.getSession();
  }

  async validateSession() {
    return this.sessionManager.validateSession();
  }

  async closeSession() {
    // Cancel all active statements before closing session
    this.log(`Cancelling ${this.activeStatements.size} active statements before closing session`);
    
    const cancellationPromises = Array.from(this.activeStatements.values()).map(async (engine) => {
      try {
        await engine.cancel();
      } catch (error) {
        this.log(`Error cancelling statement ${engine.statementId}: ${error.message}`, 'error');
      }
    });
    
    await Promise.allSettled(cancellationPromises);
    this.activeStatements.clear();
    
    return this.sessionManager.closeSession();
  }

  async refreshSession() {
    // Cancel all active statements before refreshing
    await this.closeSession();
    return this.sessionManager.createSession();
  }

  getSessionAge() {
    return this.sessionManager.getSessionAge();
  }

  // Execute SQL statement (creates a new StatementExecutionEngine)
  async executeSQL(statement, statementId = null) {
    const engine = new StatementExecutionEngine(
      this.sessionManager, 
      this.flinkApi, 
      statementId
    );
    
    engine.setDebugLogFunction(this.debugLogFunction);
    
    // Store the active statement
    this.activeStatements.set(engine.statementId, engine);
    
    this.log(`Created new statement execution engine: ${engine.statementId}`);
    
    // Add internal observer to track completion and remove from active list
    engine.addObserver((event) => {
      // Forward to global observers
      this.notifyGlobalObservers({
        type: 'statement_update',
        ...event
      });
      
      // Remove from active statements when completed
      if (event.state.statementExecutionState === 'STOPPED') {
        this.activeStatements.delete(engine.statementId);
        this.log(`Statement ${engine.statementId} completed and removed from active list`);
      }
    });
    
    try {
      // Notify global observers that a new statement started
      this.notifyGlobalObservers({
        type: 'lifecycle',
        eventType: 'statement_started',
        statementId: engine.statementId,
        statement: statement.substring(0, 100) + (statement.length > 100 ? '...' : ''),
        timestamp: Date.now()
      });
      
      const result = await engine.executeSQL(statement);
      
      // Notify global observers of completion
      this.notifyGlobalObservers({
        type: 'lifecycle',
        eventType: 'statement_completed',
        statementId: engine.statementId,
        result,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error) {
      // Remove from active statements on error
      this.activeStatements.delete(engine.statementId);
      
      // Notify global observers of error
      this.notifyGlobalObservers({
        type: 'lifecycle',
        eventType: 'statement_error',
        statementId: engine.statementId,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  // Cancel a specific statement
  async cancelStatement(statementId) {
    const engine = this.activeStatements.get(statementId);
    if (!engine) {
      this.log(`Statement ${statementId} not found in active statements`);
      return { success: false, message: 'Statement not found' };
    }

    this.log(`Cancelling statement: ${statementId}`);
    
    try {
      const result = await engine.cancel();
      this.activeStatements.delete(statementId);
      
      // Notify global observers
      this.notifyGlobalObservers({
        type: 'lifecycle',
        eventType: 'statement_cancelled',
        statementId,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      this.log(`Error cancelling statement ${statementId}: ${error.message}`, 'error');
      throw error;
    }
  }

  // Cancel all active statements
  async cancelAllStatements() {
    this.log(`Cancelling all ${this.activeStatements.size} active statements`);
    
    const cancellationPromises = Array.from(this.activeStatements.entries()).map(async ([statementId, engine]) => {
      try {
        await engine.cancel();
        return { statementId, success: true };
      } catch (error) {
        this.log(`Error cancelling statement ${statementId}: ${error.message}`, 'error');
        return { statementId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(cancellationPromises);
    this.activeStatements.clear();
    
    // Notify global observers
    this.notifyGlobalObservers({
      type: 'lifecycle',
      eventType: 'all_statements_cancelled',
      results: results.map(r => r.value || { success: false, error: r.reason }),
      timestamp: Date.now()
    });
    
    return results;
  }

  // Get information about a specific statement
  getStatementInfo(statementId) {
    const engine = this.activeStatements.get(statementId);
    return engine ? engine.getState() : null;
  }

  // Get information about all active statements
  getAllActiveStatements() {
    const statements = {};
    this.activeStatements.forEach((engine, statementId) => {
      statements[statementId] = engine.getState();
    });
    return statements;
  }

  // Add observer to a specific statement
  addStatementObserver(statementId, observer) {
    const engine = this.activeStatements.get(statementId);
    if (engine) {
      engine.addObserver(observer);
      return true;
    }
    return false;
  }

  // Remove observer from a specific statement
  removeStatementObserver(statementId, observer) {
    const engine = this.activeStatements.get(statementId);
    if (engine) {
      engine.removeObserver(observer);
      return true;
    }
    return false;
  }

  // Get count of active statements
  getActiveStatementCount() {
    return this.activeStatements.size;
  }

  // Check if any statements are running
  hasRunningStatements() {
    return Array.from(this.activeStatements.values()).some(engine => engine.isRunning());
  }

  // Get only running statements
  getRunningStatements() {
    const running = {};
    this.activeStatements.forEach((engine, statementId) => {
      if (engine.isRunning()) {
        running[statementId] = engine.getState();
      }
    });
    return running;
  }

  // Legacy compatibility methods for existing code
  
  // Legacy method - execute SQL and return results (for backward compatibility)
  async executeSQLLegacy(statement, progressCallback = null) {
    const engine = new StatementExecutionEngine(this.sessionManager, this.flinkApi);
    engine.setDebugLogFunction(this.debugLogFunction);
    
    if (progressCallback) {
      engine.addObserver((event) => {
        // Transform to legacy format
        const legacyEvent = {
          currentStatus: event.state.statementExecutionState === 'RUNNING' ? 'RUNNING' : 'COMPLETED',
          message: `Statement ${event.statementId}: ${event.state.statementExecutionState}`,
          content: {
            results: event.state.results,
            columns: event.state.columns,
            rowCount: event.state.results.length,
            columnCount: event.state.columns.length
          },
          resultType: event.state.resultType,
          resultKind: event.state.resultKind,
          status: event.state.statementExecutionState === 'RUNNING' ? 'RUNNING' : 'FINISHED',
          results: event.state.results,
          columns: event.state.columns,
          timestamp: event.timestamp,
          operationHandle: event.operationHandle,
          statementId: event.statementId
        };
        progressCallback(legacyEvent);
      });
    }
    
    return engine.executeSQL(statement);
  }

  // Legacy method - cancel operation (for backward compatibility)  
  async cancelOperation(operationHandle) {
    // Find statement by operation handle
    for (const [statementId, engine] of this.activeStatements.entries()) {
      if (engine.operationHandle === operationHandle) {
        return this.cancelStatement(statementId);
      }
    }
    
    this.log(`Operation handle ${operationHandle} not found in active statements`);
    return { success: false, message: 'Operation not found' };
  }
}

export default StatementManager;
