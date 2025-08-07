import React from 'react';

const ExecutionHistory = ({ history, onSelectExecution, onClearHistory }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'RUNNING':
        return <div className="status-indicator status-running"></div>;
      case 'FINISHED':
        return <div className="status-indicator status-finished"></div>;
      case 'ERROR':
        return <div className="status-indicator status-error"></div>;
      default:
        return <div className="status-indicator" style={{ background: 'var(--vscode-text-secondary)' }}></div>;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const truncateQuery = (query, maxLength = 60) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  if (history.length === 0) {
    return (
      <div style={{ padding: '8px', color: 'var(--vscode-text-secondary)', fontSize: '12px' }}>
        No execution history yet
      </div>
    );
  }

  return (
    <div>
      {history.map((execution, index) => (
        <div
          key={execution.id}
          className="history-item"
          onClick={() => onSelectExecution(execution)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {getStatusIcon(execution.status)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--vscode-text-secondary)' }}>
              {formatTimestamp(execution.timestamp)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--vscode-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {truncateQuery(execution.query)}
            </div>
            {execution.status === 'ERROR' && execution.error && (
              <div style={{ fontSize: '11px', color: 'var(--vscode-red)', marginTop: '2px' }}>
                Error: {execution.error}
              </div>
            )}
            {execution.status === 'FINISHED' && execution.results && (
              <div style={{ fontSize: '11px', color: 'var(--vscode-green)', marginTop: '2px' }}>
                {execution.results.length} row{execution.results.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExecutionHistory;
