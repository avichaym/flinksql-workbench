import React, { useState, useRef, useEffect } from 'react';
import { Bug, Trash2, Download, Filter, Search, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('DebugPanel');

const DebugPanel = ({ debugLogs = [], onClearLogs }) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);

  // Limit logs to 300 entries (keep most recent)
  const MAX_LOG_ENTRIES = 300;
  const limitedLogs = debugLogs.slice(-MAX_LOG_ENTRIES);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [limitedLogs, autoScroll]);

  // Filter logs based on type and search term
  const filteredLogs = limitedLogs.filter(log => {
    const matchesFilter = filter === 'all' || log.type === filter;
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get log type counts
  const logCounts = limitedLogs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, {});

  // Clear all logs
  const clearLogs = () => {
    if (onClearLogs) {
      onClearLogs();
    } else {
      log.warn('clearLogs', 'No clear logs handler provided');
    }
  };

  // Export logs to file
  const exportLogs = () => {
    const logsText = limitedLogs.map(log => 
      `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flink-debug-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get icon for log type
  const getLogTypeIcon = (type) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-3 h-3 text-red-400" />;
      case 'warn':
        return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'info':
      default:
        return <Info className="w-3 h-3 text-blue-400" />;
    }
  };

  // Get CSS class for log type
  const getLogTypeClass = (type) => {
    switch (type) {
      case 'error':
        return 'debug-log-error';
      case 'warn':
        return 'debug-log-warn';
      case 'success':
        return 'debug-log-success';
      case 'info':
      default:
        return 'debug-log-info';
    }
  };

  // Handle scroll to detect when user scrolls up (disable auto-scroll)
  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  return (
    <div className="debug-panel-content">
      {/* Header with just controls */}
      <div className="debug-panel-header">
        <div className="debug-log-count">
          ({filteredLogs.length}/{limitedLogs.length})
          {debugLogs.length > MAX_LOG_ENTRIES && (
            <span className="text-xs text-amber-400 ml-1" title={`Showing last ${MAX_LOG_ENTRIES} of ${debugLogs.length} total entries`}>
              [Trimmed]
            </span>
          )}
        </div>
        <div className="debug-header-actions">
          <button
            onClick={exportLogs}
            className="btn-icon-only btn-secondary"
            title="Export logs"
            disabled={limitedLogs.length === 0}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearLogs}
            className="btn-icon-only btn-secondary"
            title="Clear logs"
            disabled={limitedLogs.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="debug-panel-controls">
        {/* Search */}
        <div className="debug-search-container">
          <div className="debug-search-wrapper">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="debug-search-input"
            />
          </div>
        </div>

        {/* Filter */}
        <div className="debug-filter-container">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="debug-filter-select"
          >
            <option value="all">All ({logCounts.total || 0})</option>
            <option value="error">Errors ({logCounts.error || 0})</option>
            <option value="warn">Warnings ({logCounts.warn || 0})</option>
            <option value="info">Info ({logCounts.info || 0})</option>
            <option value="success">Success ({logCounts.success || 0})</option>
          </select>
        </div>

        {/* Auto-scroll toggle */}
        <div className="debug-autoscroll-container">
          <label className="debug-autoscroll-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="debug-autoscroll-checkbox"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Logs Display */}
      <div 
        className="debug-panel-body"
        ref={logsContainerRef}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="debug-empty">
            <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">
              {debugLogs.length === 0 
                ? 'No debug logs yet'
                : 'No logs match your filter'
              }
            </div>
            <div className="text-xs mt-1 text-gray-400">
              Debug information will appear here
            </div>
          </div>
        ) : (
          <div className="debug-logs-list">
            {filteredLogs.map((log, index) => (
              <div key={log.id || index} className={`debug-log-entry ${getLogTypeClass(log.type)}`}>
                <div className="debug-log-type">
                  {getLogTypeIcon(log.type)}
                </div>
                <div className="debug-log-timestamp">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  }) : log.timestamp}
                </div>
                {log.module && (
                  <div className="debug-log-module">
                    [{log.module}]
                  </div>
                )}
                {log.levelName && (
                  <div className="debug-log-level">
                    {log.levelName}
                  </div>
                )}
                <div className="debug-log-message">
                  {log.message}
                </div>
                {log.data && (
                  <div className="debug-log-data">
                    {typeof log.data === 'object' ? JSON.stringify(log.data) : log.data}
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="debug-panel-footer">
        <div className="debug-status">
          <span className="text-xs text-gray-400">
            Logs: {filteredLogs.length} / {debugLogs.length} | 
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
