import React from 'react';
import { Database, Clock, RefreshCw, X, Settings, Plus } from 'lucide-react';

const SessionInfo = ({ sessionInfo, onRefreshSession, onCloseSession, onNewSession, onToggleExpanded }) => {
  const [expanded, setExpanded] = React.useState(false);

  const handleToggle = () => {
    setExpanded(!expanded);
    if (onToggleExpanded) {
      onToggleExpanded(!expanded);
    }
  };

  const formatAge = (ageMs) => {
    if (!ageMs) return '0s';
    
    const minutes = Math.floor(ageMs / 60000);
    const seconds = Math.floor((ageMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusColor = () => {
    if (!sessionInfo.isActive) return 'text-red-400';
    if (sessionInfo.age > 25 * 60 * 1000) return 'text-yellow-400'; // > 25 minutes
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (!sessionInfo.isActive) return '❌';
    if (sessionInfo.age > 25 * 60 * 1000) return '⚠️'; // > 25 minutes
    return '✅';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-600 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-blue-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Session</span>
              <span className={`text-sm ${getStatusColor()}`}>
                {getStatusIcon()} {sessionInfo.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {sessionInfo.isActive && (
              <div className="text-xs text-gray-400">
                ID: {sessionInfo.sessionHandle?.substring(0, 8)}...
                {sessionInfo.age > 0 && (
                  <span className="ml-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatAge(sessionInfo.age)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onNewSession}
            className="text-sm bg-green-600 hover:bg-green-700 px-2 py-1 rounded flex items-center gap-1"
            title="Start New Session (closes current session)"
          >
            <Plus className="w-3 h-3" />
            New Session
          </button>
          {sessionInfo.isActive && (
            <>
              <button
                onClick={onRefreshSession}
                className="text-sm bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded flex items-center gap-1"
                title="Refresh Session"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
              <button
                onClick={onCloseSession}
                className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded flex items-center gap-1"
                title="Close Session"
              >
                <X className="w-3 h-3" />
                Close
              </button>
            </>
          )}
          <button
            onClick={handleToggle}
            className="text-sm bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded"
            title={expanded ? "Hide Details" : "Show Details"}
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Session Handle:</strong>
              <div className="text-xs text-gray-400 font-mono break-all">
                {sessionInfo.sessionHandle || 'None'}
              </div>
            </div>
            <div>
              <strong>Status:</strong>
              <div className={`text-xs ${getStatusColor()}`}>
                {sessionInfo.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div>
              <strong>Age:</strong>
              <div className="text-xs text-gray-400">
                {sessionInfo.age > 0 ? formatAge(sessionInfo.age) : 'N/A'}
              </div>
            </div>
            <div>
              <strong>Start Time:</strong>
              <div className="text-xs text-gray-400">
                {sessionInfo.startTime ? new Date(sessionInfo.startTime).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>
          
          {sessionInfo.properties && Object.keys(sessionInfo.properties).length > 0 && (
            <div className="mt-3">
              <strong className="text-sm">Properties:</strong>
              <div className="text-xs text-gray-400 mt-1 bg-black rounded p-2 max-h-32 overflow-y-auto">
                <pre>{JSON.stringify(sessionInfo.properties, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionInfo;
