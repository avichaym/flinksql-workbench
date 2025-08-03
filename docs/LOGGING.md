# Centralized Logging System

This document describes the new centralized logging system implemented in the Flink SQL Workbench.

## Overview

The new logging system provides:
- Centralized configuration and control
- Multiple log levels (TRACE, DEBUG, INFO, WARN, ERROR)
- Module-specific loggers
- Configurable output destinations (console, debug panel)
- Structured log format with timestamps, modules, and function names
- Function entry/exit tracing capabilities

## Usage

### Basic Logging

```javascript
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('MyModule');

// Different log levels
log.trace('functionName', 'Very detailed execution info');
log.debug('functionName', 'Debugging information');
log.info('functionName', 'General information');
log.warn('functionName', 'Warning message');
log.error('functionName', 'Error message');
```

### Logging with Data

```javascript
log.info('processUser', 'User data processed', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString()
});
```

### Function Tracing

```javascript
// Function entry
log.traceEnter('apiCall', { endpoint: '/api/users', method: 'GET' });

// Function exit
log.traceExit('apiCall', { status: 200, responseTime: '150ms' });
```

### Error Logging

```javascript
try {
  // some operation
} catch (error) {
  log.error('operationName', `Operation failed: ${error.message}`, {
    stack: error.stack,
    context: 'Additional context'
  });
}
```

## Configuration

The logging system can be configured through the Settings Panel or programmatically:

### Settings Panel
- **Log Level**: Minimum log level for application logging
- **Console Log Level**: Minimum log level for browser console output
- **Debug Panel Log Level**: Minimum log level for debug panel display
- **Show TRACE in Debug Panel**: Enable TRACE logs in debug panel

### Programmatic Configuration

```javascript
import logger, { LOG_LEVELS } from '../utils/logger.js';

logger.configure({
  level: LOG_LEVELS.INFO,           // Application log level
  consoleLevel: LOG_LEVELS.WARN,    // Console output level
  panelLevel: LOG_LEVELS.INFO,      // Debug panel level
  enableTraceInPanel: false,        // Show TRACE in panel
  modules: {                        // Module-specific levels
    'FlinkApi': LOG_LEVELS.DEBUG,
    'SqlEditor': LOG_LEVELS.INFO
  }
});
```

## Log Levels

| Level | Value | Description | Use Case |
|-------|-------|-------------|----------|
| TRACE | 0 | Very detailed execution flow | Function entry/exit, detailed execution steps |
| DEBUG | 1 | Debugging information | Variable values, conditional paths |
| INFO  | 2 | General information | Key operations, user actions |
| WARN  | 3 | Warning messages | Non-critical issues, deprecated usage |
| ERROR | 4 | Error messages | Exceptions, critical failures |

## Log Format

Each log entry contains:
- **Timestamp**: ISO string timestamp
- **Level**: Log level (TRACE, DEBUG, INFO, WARN, ERROR)
- **Module**: Source module name
- **Function**: Function name (if provided)
- **Message**: Log message
- **Data**: Additional structured data (optional)

Example log entry:
```json
{
  "id": "1640995200000-abc123",
  "timestamp": "2023-12-31T23:59:59.999Z",
  "level": 2,
  "levelName": "INFO",
  "module": "FlinkApi",
  "functionName": "submitStatement",
  "message": "submitStatement() - Statement submitted: op_123",
  "data": { "operationHandle": "op_123" },
  "type": "info"
}
```

## Migration from console.log

Replace existing console.log statements:

### Before
```javascript
console.log('📝 Executing SQL:', statement);
console.error('❌ Operation failed:', error);
```

### After
```javascript
import logger from '../utils/logger.js';
const log = logger.getModuleLogger('ModuleName');

log.info('executeSQL', `Executing SQL: ${statement}`);
log.error('executeSQL', `Operation failed: ${error.message}`);
```

## Best Practices

1. **Use appropriate log levels**:
   - TRACE for function entry/exit and detailed flow
   - INFO for key operations and user actions
   - WARN for non-critical issues
   - ERROR for exceptions and failures

2. **Include context in messages**:
   ```javascript
   // Good
   log.info('submitQuery', `Query submitted: ${queryId}`);
   
   // Better
   log.info('submitQuery', 'Query submitted', { queryId, length: query.length });
   ```

3. **Use function names consistently**:
   ```javascript
   async function processData(data) {
     log.traceEnter('processData', { dataSize: data.length });
     // ... processing
     log.traceExit('processData');
   }
   ```

4. **Log errors with context**:
   ```javascript
   catch (error) {
     log.error('processData', `Processing failed: ${error.message}`, {
       error: error.stack,
       input: data,
       step: 'validation'
     });
   }
   ```

## Performance Considerations

- TRACE logs can be verbose; use judiciously
- Structured data is JSON serialized; avoid large objects
- Console output is limited by browser; debug panel shows formatted logs
- Logs are kept in memory (default: 1000 entries) with automatic cleanup

## Components Integration

### Debug Panel
- Displays structured logs with module, level, and timestamp
- Supports filtering by log level
- Shows expandable data objects
- Auto-scroll functionality

### Settings Panel
- Configure log levels for different outputs
- Module-specific log level overrides
- Enable/disable TRACE in debug panel

## Testing

Use the `LoggerDemo` component to test logging functionality:

```javascript
import LoggerDemo from './components/LoggerDemo';

// Add to your component tree temporarily for testing
<LoggerDemo />
```

This provides buttons to test different logging scenarios and verify the system works correctly.
