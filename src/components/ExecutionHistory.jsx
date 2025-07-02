import React from 'react';
import { Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

const ExecutionHistory = ({ history, onSelectExecution, onClearHistory }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'RUNNING':
        return <Clock className="w-3 h-3 text-orange-500 animate-spin" />;
      case 'FINISHED':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'ERROR':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const truncateQuery = (query, maxLength = 50) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  if (history.length === 0) {
    return (
      <div className="execution-history">
        <div className="p-4 text-center text-gray-400">
          <p className="text-sm">No execution history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="execution-history">
      <div className="flex justify-between items-center p-3 border-b border-gray-600">
        <span className="text-sm font-medium">Execution History</span>
        <button
          onClick={onClearHistory}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          title="Clear History"
        >
          <RotateCcw className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {history.map((execution, index) => (
          <div
            key={execution.id}
            className="history-item"
            onClick={() => onSelectExecution(execution)}
            title={execution.query}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getStatusIcon(execution.status)}
                <span className="text-sm truncate">
                  {truncateQuery(execution.query)}
                </span>
              </div>
              <div className="text-xs text-gray-400 ml-2 flex-shrink-0">
                {formatTimestamp(execution.timestamp)}
              </div>
            </div>
            {execution.status === 'ERROR' && execution.error && (
              <div className="text-xs text-red-400 mt-1 truncate">
                Error: {execution.error}
              </div>
            )}
            {execution.status === 'FINISHED' && execution.results && (
              <div className="text-xs text-gray-400 mt-1">
                {execution.results.length} row{execution.results.length !== 1 ? 's' : ''} returned
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutionHistory;
