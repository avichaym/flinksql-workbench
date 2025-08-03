import React, { useState, useCallback, useEffect } from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import SqlEditor from '../components/SqlEditor';
import ResultsDisplay from '../components/ResultsDisplay';
import ExecutionHistory from '../components/ExecutionHistory';
import CatalogPanel from '../components/CatalogPanel';
import JobsPanel from '../components/JobsPanel';
import SnippetsPanel from '../components/SnippetsPanel';
import SessionInfo from '../components/SessionInfo';
import DebugPanel from '../components/DebugPanel';
import { Play, PlayCircle, Square, Minimize2, Maximize2, RefreshCw } from 'lucide-react';

// Define the available panels
export const MOSAIC_PANELS = {
  EDITOR: 'editor',
  RESULTS: 'results',
  HISTORY: 'history',
  CATALOGS: 'catalogs',
  JOBS: 'jobs',
  SNIPPETS: 'snippets',
  SESSION: 'session',
  DEBUG: 'debug'
};

// Default layout configuration
const DEFAULT_LAYOUT = {
  direction: 'row',
  first: {
    // Left side: All informational panels stacked vertically
    direction: 'column',
    first: {
      direction: 'column',
      first: MOSAIC_PANELS.CATALOGS,
      second: MOSAIC_PANELS.JOBS,
      splitPercentage: 50
    },
    second: {
      direction: 'column',
      first: MOSAIC_PANELS.SNIPPETS,
      second: MOSAIC_PANELS.HISTORY,
      splitPercentage: 50
    },
    splitPercentage: 50
  },
  second: {
    // Right side: SQL workflow - Editor on top, Results and Debug below
    direction: 'column',
    first: MOSAIC_PANELS.EDITOR,
    second: {
      direction: 'column',
      first: MOSAIC_PANELS.RESULTS,
      second: MOSAIC_PANELS.DEBUG,
      splitPercentage: 50
    },
    splitPercentage: 50
  },
  splitPercentage: 25
};

const MosaicLayout = ({ 
  // Editor props
  sqlEditorRef,
  query,
  setQuery,
  executeSelectedQuery,
  executeBatchQueries,
  stopExecution,
  isMainExecuting,
  isBatchExecuting,
  batchProgress,
  
  // Results and History props
  mainResult,
  history,
  handleSelectExecution,
  handleClearHistory,
  
  // Session and catalog props
  sessionInfo,
  handleSnippetInsert,
  
  // Debug logs
  debugLogs,
  handleClearDebugLogs
}) => {
  const LAYOUT_CACHE_KEY = 'flink-workbench-mosaic-layout';
  const [currentLayout, setCurrentLayout] = useState(() => {
    // Try to load from cache on mount
    const cached = localStorage.getItem(LAYOUT_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Ignore parse errors
      }
    }
    return DEFAULT_LAYOUT;
  });
  // Save layout to localStorage
  const saveLayoutToCache = useCallback((layout) => {
    try {
      localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(layout));
    } catch (e) {
      // Ignore errors
    }
  }, []);

  // Reset layout to default
  const resetLayoutToDefault = useCallback(() => {
    setCurrentLayout(DEFAULT_LAYOUT);
    saveLayoutToCache(DEFAULT_LAYOUT);
  }, [saveLayoutToCache]);

  // Listen for save/reset events
  useEffect(() => {
    const handleSaveLayout = () => {
      saveLayoutToCache(currentLayout);
    };
    const handleResetLayout = () => {
      resetLayoutToDefault();
    };
    window.addEventListener('saveLayout', handleSaveLayout);
    window.addEventListener('resetLayout', handleResetLayout);
    return () => {
      window.removeEventListener('saveLayout', handleSaveLayout);
      window.removeEventListener('resetLayout', handleResetLayout);
    };
  }, [currentLayout, resetLayoutToDefault, saveLayoutToCache]);
  const [collapsedPanels, setCollapsedPanels] = useState(new Set());

  // Function to calculate dynamic layout based on collapsed panels
  const calculateDynamicLayout = useCallback((collapsedSet) => {
    // Helper function to calculate split percentage based on collapsed state
    const calculateSplitPercentage = (firstCollapsed, secondCollapsed, defaultPercentage = 50) => {
      if (firstCollapsed && secondCollapsed) return defaultPercentage;
      if (firstCollapsed) return 10; // Minimal space for collapsed panel
      if (secondCollapsed) return 90; // Most space for expanded panel
      return defaultPercentage;
    };

    // Dynamic layout structure
    return {
      direction: 'row',
      first: {
        // Left side: All informational panels stacked vertically
        direction: 'column',
        first: {
          direction: 'column',
          first: MOSAIC_PANELS.CATALOGS,
          second: MOSAIC_PANELS.JOBS,
          splitPercentage: calculateSplitPercentage(
            collapsedSet.has(MOSAIC_PANELS.CATALOGS),
            collapsedSet.has(MOSAIC_PANELS.JOBS)
          )
        },
        second: {
          direction: 'column',
          first: MOSAIC_PANELS.SNIPPETS,
          second: MOSAIC_PANELS.HISTORY,
          splitPercentage: calculateSplitPercentage(
            collapsedSet.has(MOSAIC_PANELS.SNIPPETS),
            collapsedSet.has(MOSAIC_PANELS.HISTORY)
          )
        },
        splitPercentage: calculateSplitPercentage(
          collapsedSet.has(MOSAIC_PANELS.CATALOGS) && collapsedSet.has(MOSAIC_PANELS.JOBS),
          collapsedSet.has(MOSAIC_PANELS.SNIPPETS) && collapsedSet.has(MOSAIC_PANELS.HISTORY)
        )
      },
      second: {
        // Right side: SQL workflow - Editor on top, Results and Debug below
        direction: 'column',
        first: MOSAIC_PANELS.EDITOR,
        second: {
          direction: 'column',
          first: MOSAIC_PANELS.RESULTS,
          second: MOSAIC_PANELS.DEBUG,
          splitPercentage: calculateSplitPercentage(
            collapsedSet.has(MOSAIC_PANELS.RESULTS),
            collapsedSet.has(MOSAIC_PANELS.DEBUG),
            70
          )
        },
        splitPercentage: calculateSplitPercentage(
          collapsedSet.has(MOSAIC_PANELS.EDITOR),
          collapsedSet.has(MOSAIC_PANELS.RESULTS) && collapsedSet.has(MOSAIC_PANELS.DEBUG),
          50
        )
      },
      splitPercentage: calculateSplitPercentage(
        collapsedSet.has(MOSAIC_PANELS.CATALOGS) && 
        collapsedSet.has(MOSAIC_PANELS.JOBS) && 
        collapsedSet.has(MOSAIC_PANELS.SNIPPETS) && 
        collapsedSet.has(MOSAIC_PANELS.HISTORY), // All left panels collapsed
        collapsedSet.has(MOSAIC_PANELS.EDITOR) && 
        collapsedSet.has(MOSAIC_PANELS.RESULTS) && 
        collapsedSet.has(MOSAIC_PANELS.DEBUG), // All right panels collapsed
        25
      )
    };
  }, []);

  // Update layout when panels are collapsed/expanded
  const updateLayoutForCollapsedPanels = useCallback((newCollapsedSet) => {
    const newLayout = calculateDynamicLayout(newCollapsedSet);
    setCurrentLayout(newLayout);
  }, [calculateDynamicLayout]);

  // Toggle panel collapsed state
  const togglePanelCollapse = useCallback((panelId) => {
    setCollapsedPanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      
      // Update layout based on new collapsed state
      updateLayoutForCollapsedPanels(newSet);
      
      // Notify components that panels have been resized with multiple events
      // Immediate notification
      window.dispatchEvent(new CustomEvent('panelStateChange', { detail: { panelId, collapsed: newSet.has(panelId) } }));
      
      // Additional notifications at different intervals to handle transitions
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
        window.dispatchEvent(new CustomEvent('panelStateChange', { detail: { panelId, collapsed: newSet.has(panelId) } }));
      }, 50);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
      }, 150);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
      }, 300);
      
      return newSet;
    });
  }, [updateLayoutForCollapsedPanels]);

  // Render function for each panel type
  const renderTile = useCallback((id, path) => {
    const commonProps = {
      sessionInfo,
      onInsertSnippet: handleSnippetInsert
    };

    const isCollapsed = collapsedPanels.has(id);

    switch (id) {
      case MOSAIC_PANELS.EDITOR:
        return (
          <div className={`mosaic-panel-content editor-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && (
              <>
                {isBatchExecuting && (
                  <div className="batch-progress">
                    <div className="progress-info">
                      <span className="progress-text">
                        Executing statement {batchProgress.current} of {batchProgress.total}
                      </span>
                      <span className="current-statement">
                        {batchProgress.currentStatement}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <div className="panel-content">
                  <SqlEditor
                    ref={sqlEditorRef}
                    value={query}
                    onChange={setQuery}
                    onExecute={executeSelectedQuery}
                    isExecuting={isMainExecuting || isBatchExecuting}
                  />
                </div>
              </>
            )}
          </div>
        );

      case MOSAIC_PANELS.RESULTS:
        return (
          <div className={`mosaic-panel-content results-panel ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && (
              <div className="panel-content">
                <ResultsDisplay 
                  result={mainResult} 
                  isExecuting={isMainExecuting || isBatchExecuting} 
                />
              </div>
            )}
          </div>
        );

      case MOSAIC_PANELS.HISTORY:
        return (
          <div className={`mosaic-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && (
              <ExecutionHistory
                history={history}
                onSelectExecution={handleSelectExecution}
                onClearHistory={handleClearHistory}
              />
            )}
          </div>
        );

      case MOSAIC_PANELS.CATALOGS:
        return (
          <div className={`mosaic-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && <CatalogPanel {...commonProps} />}
          </div>
        );

      case MOSAIC_PANELS.JOBS:
        return (
          <div className={`mosaic-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && <JobsPanel sessionInfo={sessionInfo} />}
          </div>
        );

      case MOSAIC_PANELS.SNIPPETS:
        return (
          <div className={`mosaic-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && (
              <SnippetsPanel 
                onInsertSnippet={handleSnippetInsert}
                isVisible={true}
              />
            )}
          </div>
        );

      case MOSAIC_PANELS.SESSION:
        return (
          <div className={`mosaic-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && <SessionInfo sessionInfo={sessionInfo} />}
          </div>
        );

      case MOSAIC_PANELS.DEBUG:
        return (
          <div className={`mosaic-panel-content ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && <DebugPanel debugLogs={debugLogs} onClearLogs={handleClearDebugLogs} />}
          </div>
        );

      default:
        return <div className="mosaic-panel-content">Unknown panel: {id}</div>;
    }
  }, [
    sessionInfo,
    handleSnippetInsert,
    sqlEditorRef,
    query,
    setQuery,
    executeSelectedQuery,
    executeBatchQueries,
    stopExecution,
    isMainExecuting,
    isBatchExecuting,
    batchProgress,
    mainResult,
    history,
    handleSelectExecution,
    handleClearHistory,
    debugLogs,
    collapsedPanels,
    togglePanelCollapse,
    calculateDynamicLayout,
    updateLayoutForCollapsedPanels
  ]);

  // Get panel title for the window
  const getPanelTitle = (id) => {
    switch (id) {
      case MOSAIC_PANELS.EDITOR:
        return 'SQL Editor';
      case MOSAIC_PANELS.RESULTS:
        return 'Results';
      case MOSAIC_PANELS.HISTORY:
        return 'History';
      case MOSAIC_PANELS.CATALOGS:
        return 'Catalogs';
      case MOSAIC_PANELS.JOBS:
        return 'Jobs';
      case MOSAIC_PANELS.SNIPPETS:
        return 'Snippets';
      case MOSAIC_PANELS.SESSION:
        return 'Session';
      case MOSAIC_PANELS.DEBUG:
        return 'Debug Console';
      default:
        return id;
    }
  };

  // Get toolbar controls for specific panels
  const getToolbarControls = (id) => {
    const isCollapsed = collapsedPanels.has(id);
    const controls = [];

    // Add minimize/restore button for all panels
    controls.push(
      <button
        key="minimize-restore"
        onClick={() => togglePanelCollapse(id)}
        className="mosaic-toolbar-button"
        title={isCollapsed ? "Restore panel" : "Minimize panel"}
      >
        {isCollapsed ? (
          <Maximize2 className="w-3 h-3" />
        ) : (
          <Minimize2 className="w-3 h-3" />
        )}
      </button>
    );

    // Add refresh button to Jobs panel title bar (only when not collapsed)
    if (id === MOSAIC_PANELS.JOBS && !isCollapsed) {
      controls.push(
        <button
          key="refresh-jobs"
          onClick={() => {
            // Trigger refresh via a custom event that the JobsPanel can listen to
            window.dispatchEvent(new CustomEvent('refreshJobs'));
          }}
          className="mosaic-toolbar-button"
          title="Refresh jobs"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      );
    }

    // Add refresh button to Catalogs panel title bar (only when not collapsed)
    if (id === MOSAIC_PANELS.CATALOGS && !isCollapsed) {
      controls.push(
        <button
          key="refresh-catalogs"
          onClick={() => {
            // Trigger refresh via a custom event that the CatalogPanel can listen to
            window.dispatchEvent(new CustomEvent('refreshCatalogs'));
          }}
          className="mosaic-toolbar-button"
          title="Refresh catalogs"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      );
    }

    // Add execute buttons to SQL Editor title bar (only when not collapsed)
    if (id === MOSAIC_PANELS.EDITOR && !isCollapsed) {
      if (isMainExecuting || isBatchExecuting) {
        controls.push(
          <button
            key="stop"
            onClick={stopExecution}
            className="mosaic-toolbar-button mosaic-toolbar-button-danger"
            title="Stop execution"
          >
            <Square className="w-3 h-3" />
          </button>
        );
      } else {
        controls.push(
          <button
            key="execute-selected"
            onClick={executeSelectedQuery}
            disabled={!query?.trim()}
            className="mosaic-toolbar-button mosaic-toolbar-button-primary"
            title="Execute selected query"
          >
            <Play className="w-3 h-3" />
          </button>
        );
        controls.push(
          <button
            key="execute-all"
            onClick={executeBatchQueries}
            disabled={!query?.trim()}
            className="mosaic-toolbar-button mosaic-toolbar-button-secondary"
            title="Execute all statements"
          >
            <PlayCircle className="w-3 h-3" />
          </button>
        );
      }
    }

    return controls;
  };

  return (
    <div className="mosaic-layout">
      <Mosaic
        renderTile={(id, path) => (
          <MosaicWindow
            path={path}
            createNode={() => MOSAIC_PANELS.EDITOR}
            title={getPanelTitle(id)}
            draggable={true}
            toolbarControls={getToolbarControls(id)}
          >
            {renderTile(id, path)}
          </MosaicWindow>
        )}
        value={currentLayout}
        onChange={(newLayout) => {
          setCurrentLayout(newLayout);
          saveLayoutToCache(newLayout);
          // Notify components that the layout has changed with multiple timing strategies
          window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
          });
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
          }, 50);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
          }, 150);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mosaicLayoutChange'));
          }, 300);
        }}
        className="mosaic-theme-vs-code"
      />
    </div>
  );
};

export default MosaicLayout;
