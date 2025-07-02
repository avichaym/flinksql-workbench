import flinkApi from './flinkApi.js';
import SessionManager from './sessionManager.js';

// Create session manager instance
const sessionManager = new SessionManager(flinkApi);

export { flinkApi, sessionManager };
