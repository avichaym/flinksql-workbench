/**
 * Centralized Logging Utility for Flink SQL Workbench
 * 
 * Features:
 * - Centralized logging configuration
 * - Multiple log levels (TRACE, DEBUG, INFO, WARN, ERROR)
 * - Module-specific loggers
 * - Configurable output destinations (console, debug panel)
 * - Structured log format with timestamps
 * - Function entry/exit tracing
 */

// Log levels in order of severity
export const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  OFF: 999
};

// Log level names for display
export const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.TRACE]: 'TRACE',
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR'
};

class Logger {
  constructor() {
    this.listeners = new Set();
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs in memory
    
    // Default configuration
    this.config = {
      level: LOG_LEVELS.INFO,
      consoleLevel: LOG_LEVELS.WARN, // Only WARN and ERROR go to console by default
      panelLevel: LOG_LEVELS.INFO,   // INFO and above go to debug panel
      enableTraceInPanel: false,     // Whether TRACE logs appear in panel (controlled by settings)
      modules: {} // Module-specific log levels
    };

    // Bind methods to preserve context
    this.trace = this.trace.bind(this);
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
  }

  /**
   * Configure the logger
   * @param {Object} config - Configuration object
   */
  configure(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set whether TRACE logs should appear in debug panel
   * @param {boolean} enabled 
   */
  setTraceInPanelEnabled(enabled) {
    this.config.enableTraceInPanel = enabled;
  }

  /**
   * Add a listener for log events
   * @param {Function} listener - Function to call when logs are added
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a log listener
   * @param {Function} listener 
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Create a formatted log entry
   * @param {string} level - Log level
   * @param {string} module - Module name
   * @param {string} functionName - Function name (optional)
   * @param {string} message - Log message
   * @param {any} data - Additional data (optional)
   */
  createLogEntry(level, module, functionName, message, data = null) {
    const now = new Date();
    const timestamp = now.toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    
    let formattedMessage = message;
    if (functionName) {
      formattedMessage = `${functionName}() - ${message}`;
    }
    
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      level,
      levelName,
      module,
      functionName,
      message: formattedMessage,
      data,
      type: this.mapLevelToType(level) // For compatibility with existing debug panel
    };

    return logEntry;
  }

  /**
   * Map log level to debug panel type
   * @param {number} level 
   * @returns {string}
   */
  mapLevelToType(level) {
    switch (level) {
      case LOG_LEVELS.TRACE:
      case LOG_LEVELS.DEBUG:
        return 'info';
      case LOG_LEVELS.INFO:
        return 'info';
      case LOG_LEVELS.WARN:
        return 'warn';
      case LOG_LEVELS.ERROR:
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Check if a log should be output based on level and configuration
   * @param {number} level 
   * @param {string} module 
   * @returns {boolean}
   */
  shouldLog(level, module) {
    const moduleLevel = this.config.modules[module] || this.config.level;
    return level >= moduleLevel;
  }

  /**
   * Send log to appropriate destinations (console, panel)
   * @param {Object} logEntry 
   */
  outputLog(logEntry) {
    const { level, module, message, data } = logEntry;

    // Add to in-memory logs
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console if level is high enough
    if (level >= this.config.consoleLevel) {
      // Format timestamp to HH:MM:SS
      const timestamp = new Date(logEntry.timestamp).toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const consoleMessage = `[${timestamp}] [${logEntry.module}] ${logEntry.message}`;
      
      switch (level) {
        case LOG_LEVELS.TRACE:
        case LOG_LEVELS.DEBUG:
          console.debug(consoleMessage, data || '');
          break;
        case LOG_LEVELS.INFO:
          console.info(consoleMessage, data || '');
          break;
        case LOG_LEVELS.WARN:
          console.warn(consoleMessage, data || '');
          break;
        case LOG_LEVELS.ERROR:
          console.error(consoleMessage, data || '');
          break;
      }
    }

    // Send to debug panel if level is appropriate
    const shouldSendToPanel = level >= this.config.panelLevel || 
      (level === LOG_LEVELS.TRACE && this.config.enableTraceInPanel);

    if (shouldSendToPanel) {
      // Notify listeners (debug panel)
      this.listeners.forEach(listener => {
        try {
          listener(logEntry);
        } catch (error) {
          // Use direct console.error here to avoid infinite recursion
          console.error('Error in log listener:', error);
        }
      });
    }
  }

  /**
   * Core logging method
   * @param {number} level 
   * @param {string} module 
   * @param {string} functionName 
   * @param {string} message 
   * @param {any} data 
   */
  log(level, module, functionName, message, data = null) {
    if (!this.shouldLog(level, module)) {
      return;
    }

    const logEntry = this.createLogEntry(level, module, functionName, message, data);
    this.outputLog(logEntry);
  }

  /**
   * TRACE level logging - for function entry/exit and detailed execution flow
   */
  trace(module, functionName, message, data = null) {
    this.log(LOG_LEVELS.TRACE, module, functionName, message, data);
  }

  /**
   * DEBUG level logging - for detailed debugging information
   */
  debug(module, functionName, message, data = null) {
    this.log(LOG_LEVELS.DEBUG, module, functionName, message, data);
  }

  /**
   * INFO level logging - for general information and key execution points
   */
  info(module, functionName, message, data = null) {
    this.log(LOG_LEVELS.INFO, module, functionName, message, data);
  }

  /**
   * WARN level logging - for warnings and non-critical issues
   */
  warn(module, functionName, message, data = null) {
    this.log(LOG_LEVELS.WARN, module, functionName, message, data);
  }

  /**
   * ERROR level logging - for errors and critical issues
   */
  error(module, functionName, message, data = null) {
    this.log(LOG_LEVELS.ERROR, module, functionName, message, data);
  }

  /**
   * Get all logs
   * @returns {Array}
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    // Notify listeners about the clear
    this.listeners.forEach(listener => {
      try {
        listener({ type: 'clear' });
      } catch (error) {
        // Use direct console.error here to avoid infinite recursion
        console.error('Error in log listener during clear:', error);
      }
    });
  }

  /**
   * Create a module-specific logger instance
   * @param {string} moduleName 
   * @returns {ModuleLogger}
   */
  getModuleLogger(moduleName) {
    return new ModuleLogger(this, moduleName);
  }
}

/**
 * Module-specific logger that automatically includes module name
 */
class ModuleLogger {
  constructor(logger, moduleName) {
    this.logger = logger;
    this.moduleName = moduleName;
  }

  trace(functionName, message, data = null) {
    this.logger.trace(this.moduleName, functionName, message, data);
  }

  debug(functionName, message, data = null) {
    this.logger.debug(this.moduleName, functionName, message, data);
  }

  info(functionName, message, data = null) {
    this.logger.info(this.moduleName, functionName, message, data);
  }

  warn(functionName, message, data = null) {
    this.logger.warn(this.moduleName, functionName, message, data);
  }

  error(functionName, message, data = null) {
    this.logger.error(this.moduleName, functionName, message, data);
  }

  /**
   * Helper method for tracing function entry with arguments
   * @param {string} functionName 
   * @param {Object} args - Function arguments
   */
  traceEnter(functionName, args = null) {
    const argsStr = args ? ` with args: ${JSON.stringify(args)}` : '';
    this.trace(functionName, `entering${argsStr}`);
  }

  /**
   * Helper method for tracing function exit with return value
   * @param {string} functionName 
   * @param {any} returnValue 
   */
  traceExit(functionName, returnValue = null) {
    const returnStr = returnValue !== null ? ` returning: ${JSON.stringify(returnValue)}` : '';
    this.trace(functionName, `exiting${returnStr}`);
  }
}

// Create and export the singleton logger instance
const logger = new Logger();

/**
 * Convenience function to create module loggers
 * @param {string} moduleName 
 * @returns {ModuleLogger}
 */
export function createModuleLogger(moduleName) {
  return logger.getModuleLogger(moduleName);
}

export { logger, ModuleLogger };
export default logger;
