import flinkApi from './flinkApi.js';
import SessionManager from './sessionManager.js';
import StatementExecutionEngine from './statementExecutionEngine.js';
import StatementManager from './statementManager.js';
import settingsService from './settingsService.js';

// Create singleton session manager instance
const sessionManager = SessionManager.getInstance(flinkApi);

// Create statement manager instance (uses singleton session manager)
const statementManager = new StatementManager(flinkApi);

export { 
  flinkApi, 
  sessionManager,      // Singleton session manager
  statementManager,    // Statement manager (uses singleton session manager)
  SessionManager,      // For direct instantiation (will return singleton)
  StatementExecutionEngine, // For direct instantiation
  StatementManager,    // For direct instantiation
  settingsService 
};
