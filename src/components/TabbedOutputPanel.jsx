import React, { useState, useEffect } from 'react';
import { FileText, Bug, AlertCircle } from 'lucide-react';
import ResultsDisplay from './ResultsDisplay';
import DebugPanel from './DebugPanel';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('TabbedOutputPanel');

const TabbedOutputPanel = ({ 
  // Results props
  result, 
  isExecuting,
  // Debug props  
  debugLogs = [], 
  onClearLogs 
}) => {
  const [activeTab, setActiveTab] = useState('results');
  
  // Auto-switch to debug tab when there are new error logs
  useEffect(() => {
    if (debugLogs.length > 0) {
      const recentErrorLogs = debugLogs.filter(log => 
        log.type === 'error' && 
        log.timestamp && 
        (Date.now() - new Date(log.timestamp).getTime()) < 5000 // Last 5 seconds
      );
      
      if (recentErrorLogs.length > 0 && activeTab === 'results') {
        log.debug('autoSwitch', 'Auto-switching to debug tab due to recent errors');
        setActiveTab('debug');
      }
    }
  }, [debugLogs, activeTab]);

  // Get counts for tab badges
  const getDebugLogCounts = () => {
    if (!debugLogs || debugLogs.length === 0) return { total: 0, errors: 0, warnings: 0 };
    
    const counts = debugLogs.reduce((acc, log) => {
      acc.total++;
      if (log.type === 'error') acc.errors++;
      if (log.type === 'warn') acc.warnings++;
      return acc;
    }, { total: 0, errors: 0, warnings: 0 });
    
    return counts;
  };

  const debugCounts = getDebugLogCounts();
  
  // Check if there are results to show
  const hasResults = result?.results && result.results.length > 0;
  const hasErrors = debugCounts.errors > 0;
  
  return (
    <div className="tabbed-output-panel">
      {/* Tab Header */}
      <div className="tabbed-output-header">
        <div className="tabbed-output-tabs">
          <button
            className={`output-tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            <FileText className="w-4 h-4" />
            Results
            {hasResults && (
              <span className="tab-badge">
                {result.results.length}
              </span>
            )}
          </button>
          
          <button
            className={`output-tab ${activeTab === 'debug' ? 'active' : ''}`}
            onClick={() => setActiveTab('debug')}
          >
            <Bug className="w-4 h-4" />
            Debug Console
            {debugCounts.total > 0 && (
              <span className={`tab-badge ${hasErrors ? 'error' : ''}`}>
                {debugCounts.total}
              </span>
            )}
            {hasErrors && (
              <AlertCircle className="w-3 h-3 text-red-400 ml-1" />
            )}
          </button>
        </div>
        
        {/* Optional: Status indicator */}
        <div className="tabbed-output-status">
          {isExecuting && (
            <span className="status-indicator executing">
              Running...
            </span>
          )}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="tabbed-output-content">
        {activeTab === 'results' && (
          <div className="tab-pane active">
            <ResultsDisplay 
              result={result} 
              isExecuting={isExecuting} 
            />
          </div>
        )}
        
        {activeTab === 'debug' && (
          <div className="tab-pane active">
            <DebugPanel 
              debugLogs={debugLogs} 
              onClearLogs={onClearLogs} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TabbedOutputPanel;
