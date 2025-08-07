import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, ChevronRight, ChevronDown, Table } from 'lucide-react';
import { useStatementExecution } from '../hooks/useStatementExecution';
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('CatalogPanel');

const CatalogPanel = ({ sessionInfo, onInsertSnippet }) => {
  const [catalogs, setCatalogs] = useState([]);
  const [currentCatalog, setCurrentCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [expandedCatalogs, setExpandedCatalogs] = useState(new Set());
  const [catalogTables, setCatalogTables] = useState(new Map()); // Store tables for each catalog
  const [loadingTables, setLoadingTables] = useState(new Set()); // Track which catalogs are loading tables

  // Use dedicated statement execution for catalog operations
  const {
    executeSQL: executeCatalogSQL,
    isExecuting: isCatalogLoading,
    result: catalogResult,
    error: catalogError
  } = useStatementExecution('CatalogPanel');

  const loadCatalogs = useCallback(async () => {
    log.traceEnter('loadCatalogs');
    setError(null);
    
    try {
      log.info('loadCatalogs', 'Loading catalogs...');
      const result = await executeCatalogSQL('SHOW CATALOGS;', { silent: true });
      
      log.debug('loadCatalogs', 'Catalog query result', result);
      
      if (result && (result.status === 'FINISHED' || result.status === 'COMPLETED')) {
        // Results can be in result.results (legacy) or result.state.results (new format)
        const resultsArray = result.results || (result.state && result.state.results);
        
        if (resultsArray && resultsArray.length > 0) {
          const catalogList = resultsArray.map(row => {
            // Handle both array format [["catalog_name"]] and object format
            if (Array.isArray(row)) {
              return row[0]; // First column is catalog name
            } else if (row.fields) {
              return row.fields[0]; // First field is catalog name
            } else {
              // Object format - find the catalog name field (e.g., field_0, catalog_name, etc.)
              const catalogField = row.field_0 || row.catalog_name || Object.values(row)[0];
              return catalogField;
            }
          }).filter(Boolean);
          
          log.info('loadCatalogs', `Loaded catalogs: ${catalogList.join(', ')}`);
          setCatalogs(catalogList);
        } else {
          log.warn('loadCatalogs', 'No catalog results found', result);
          setError('No catalogs found');
        }
      } else {
        log.warn('loadCatalogs', 'Failed to load catalogs', result);
        setError('Failed to load catalogs');
      }
    } catch (err) {
      log.error('loadCatalogs', `Error loading catalogs: ${err.message}`);
      setError('Error loading catalogs: ' + err.message);
    }
    
    log.traceExit('loadCatalogs');
  }, [executeCatalogSQL]);

  const loadCurrentCatalog = useCallback(async () => {
    try {
      log.debug('loadCurrentCatalog', 'Loading current catalog...');
      const result = await executeCatalogSQL('SHOW CURRENT CATALOG;', { silent: true });
      
      log.debug('loadCurrentCatalog', 'Current catalog query result', { result });
      
      if (result && (result.status === 'FINISHED' || result.status === 'COMPLETED')) {
        // Results can be in result.results (legacy) or result.state.results (new format)
        const resultsArray = result.results || (result.state && result.state.results);
        
        if (resultsArray && resultsArray.length > 0) {
          let currentCat;
          const row = resultsArray[0];
          
          if (Array.isArray(row)) {
            currentCat = row[0];
          } else if (row.fields) {
            currentCat = row.fields[0];
          } else {
            // Object format - find the catalog name field (e.g., field_0, catalog_name, etc.)
            currentCat = row.field_0 || row.catalog_name || Object.values(row)[0];
          }
          
          log.info('loadCurrentCatalog', 'Current catalog loaded', { currentCatalog: currentCat });
          setCurrentCatalog(currentCat);
        } else {
          log.warn('loadCurrentCatalog', 'No current catalog result found', { result });
        }
      }
    } catch (err) {
      log.error('loadCurrentCatalog', `Error loading current catalog: ${err.message}`, { 
        error: err.stack 
      });
    }
  }, [executeCatalogSQL]);

  // Load catalogs when session becomes active
  useEffect(() => {
    if (sessionInfo.isActive && sessionInfo.sessionHandle) {
      loadCatalogs();
      loadCurrentCatalog();
    } else {
      // Clear catalogs when session is inactive
      setCatalogs([]);
      setCurrentCatalog(null);
      setError(null);
      setCatalogTables(new Map());
      setLoadingTables(new Set());
      setExpandedCatalogs(new Set());
    }
  }, [sessionInfo.isActive, sessionInfo.sessionHandle, loadCatalogs, loadCurrentCatalog]);

  // Listen for refresh events from title bar button
  useEffect(() => {
    const handleRefresh = () => {
      log.info('handleRefresh', 'Refresh event received from title bar');
      loadCatalogs();
      loadCurrentCatalog();
      // Clear cached table data to force reload when expanded again
      setCatalogTables(new Map());
      setLoadingTables(new Set());
    };

    window.addEventListener('refreshCatalogs', handleRefresh);
    return () => window.removeEventListener('refreshCatalogs', handleRefresh);
  }, [loadCatalogs, loadCurrentCatalog]);

  const handleCatalogDoubleClick = async (catalogName) => {
    if (isCatalogLoading || catalogName === currentCatalog) return;
    
    try {
      log.info('handleCatalogDoubleClick', `Switching to catalog: ${catalogName}`);
      const result = await executeCatalogSQL(`USE CATALOG ${catalogName};`, { silent: false });
      
      if (result && (result.status === 'FINISHED' || result.status === 'COMPLETED')) {
        setCurrentCatalog(catalogName);
        log.info('handleCatalogDoubleClick', `Successfully switched to catalog: ${catalogName}`);
      } else {
        log.error('handleCatalogDoubleClick', 'Failed to switch catalog', { result });
      }
    } catch (err) {
      log.error('handleCatalogDoubleClick', 'Error switching catalog', { error: err.message, stack: err.stack });
    }
  };

  const toggleCatalogExpansion = async (catalogName) => {
    const newExpanded = new Set(expandedCatalogs);
    if (newExpanded.has(catalogName)) {
      newExpanded.delete(catalogName);
    } else {
      newExpanded.add(catalogName);
      // Load tables when expanding a catalog
      await loadTablesForCatalog(catalogName);
    }
    setExpandedCatalogs(newExpanded);
  };

  const loadTablesForCatalog = async (catalogName) => {
    if (loadingTables.has(catalogName) || catalogTables.has(catalogName)) {
      return; // Already loading or loaded
    }

    setLoadingTables(prev => new Set(prev).add(catalogName));

    try {
      log.debug('loadTablesForCatalog', `Loading tables for catalog: ${catalogName}`);
      
      // Switch to the catalog temporarily to get its tables
      const originalCatalog = currentCatalog;
      
      // Only switch catalog if it's different from current
      if (catalogName !== currentCatalog) {
        await executeCatalogSQL(`USE CATALOG \`${catalogName}\`;`, { silent: true });
      }
      
      // Get tables for this catalog - try different SQL commands
      let result = null;
      const sqlCommands = [
        'SHOW TABLES;',
        'SHOW FULL TABLES;'
      ];
      
      for (const sql of sqlCommands) {
        try {
          result = await executeCatalogSQL(sql, { silent: true });
          if (result && (result.status === 'FINISHED' || result.status === 'COMPLETED')) {
            break;
          }
        } catch (err) {
          log.debug('loadTablesForCatalog', `SQL command failed, trying next`, { 
            sql, 
            catalogName, 
            error: err.message 
          });
        }
      }
      
      log.debug('loadTablesForCatalog', `Tables query result`, { catalogName, result });
      
      if (result && (result.status === 'FINISHED' || result.status === 'COMPLETED')) {
        const resultsArray = result.results || (result.state && result.state.results);
        
        if (resultsArray && resultsArray.length > 0) {
          const tableList = resultsArray.map(row => {
            // Handle both array format [["table_name"]] and object format
            if (Array.isArray(row)) {
              return row[0]; // First column is table name
            } else if (row.fields) {
              return row.fields[0]; // First field is table name
            } else {
              // Object format - find the table name field
              const tableField = row.field_0 || row.table_name || Object.values(row)[0];
              return tableField;
            }
          }).filter(Boolean);
          
          log.info('loadTablesForCatalog', `Loaded tables for catalog`, { 
            catalogName, 
            tableCount: tableList.length,
            tables: tableList 
          });
          setCatalogTables(prev => new Map(prev).set(catalogName, tableList));
        } else {
          log.info('loadTablesForCatalog', `No tables found for catalog`, { catalogName });
          setCatalogTables(prev => new Map(prev).set(catalogName, []));
        }
      } else {
        log.warn('loadTablesForCatalog', `Failed to load tables for catalog`, { catalogName, result });
        setCatalogTables(prev => new Map(prev).set(catalogName, []));
      }
      
      // Switch back to original catalog if we changed it
      if (catalogName !== originalCatalog && originalCatalog) {
        await executeCatalogSQL(`USE CATALOG \`${originalCatalog}\`;`, { silent: true });
      }
      
    } catch (err) {
      log.error('loadTablesForCatalog', `Error loading tables for catalog: ${err.message}`, { 
        catalogName, 
        error: err.stack 
      });
      setCatalogTables(prev => new Map(prev).set(catalogName, []));
    } finally {
      setLoadingTables(prev => {
        const newSet = new Set(prev);
        newSet.delete(catalogName);
        return newSet;
      });
    }
  };

  if (!sessionInfo.isActive) {
    return (
      <div className="catalog-panel-content">
        <div className="catalog-panel-body">
          <div className="text-center text-gray-400 py-8">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active session</p>
            <p className="text-xs mt-1">Start a session to view catalogs</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-panel-content">
      <div className="catalog-panel-body">
        {error && (
          <div className="error-message text-xs p-2 mb-2">
            {error}
          </div>
        )}

        {isCatalogLoading ? (
          <div className="text-center text-gray-400 py-4">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading catalogs...</p>
          </div>
        ) : catalogs.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <Database className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No catalogs found</p>
          </div>
        ) : (
          <div className="catalog-list">
            {catalogs.map((catalog) => (
              <div key={catalog} className="catalog-item">
                <div
                  className={`catalog-name ${catalog === currentCatalog ? 'active' : ''} ${isCatalogLoading ? 'disabled' : ''}`}
                  onDoubleClick={() => handleCatalogDoubleClick(catalog)}
                  title={`Double-click to use catalog: ${catalog}`}
                >
                  <button
                    onClick={() => toggleCatalogExpansion(catalog)}
                    className="expand-button"
                  >
                    {expandedCatalogs.has(catalog) ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  <Database className="w-4 h-4" />
                  <span className="catalog-text">{catalog}</span>
                  {catalog === currentCatalog && (
                    <span className="current-indicator">●</span>
                  )}
                </div>
                
                {expandedCatalogs.has(catalog) && (
                  <div className="catalog-details">
                    {catalog === currentCatalog ? (
                      <div className="text-xs text-gray-400 px-6 py-1">
                        Current catalog
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 px-6 py-1">
                        Double-click to switch
                      </div>
                    )}
                    
                    {/* Tables section */}
                    <div className="catalog-tables">
                      {loadingTables.has(catalog) ? (
                        <div className="text-center text-gray-400 py-2 px-6">
                          <RefreshCw className="w-4 h-4 mx-auto mb-1 animate-spin" />
                          <p className="text-xs">Loading tables...</p>
                        </div>
                      ) : catalogTables.has(catalog) ? (
                        catalogTables.get(catalog).length > 0 ? (
                          <div className="tables-list">
                            <div className="text-xs text-gray-500 px-6 py-1 font-medium">
                              Tables ({catalogTables.get(catalog).length})
                            </div>
                            {catalogTables.get(catalog).map((table) => (
                              <div 
                                key={table} 
                                className="table-item"
                                title={`Table: ${table} (Click to insert in editor)`}
                                onClick={() => {
                                  if (onInsertSnippet) {
                                    // Insert a qualified table name if not the current catalog
                                    const tableRef = catalog === currentCatalog ? table : `\`${catalog}\`.\`default_database\`.\`${table}\``;
                                    onInsertSnippet(tableRef);
                                  }
                                }}
                              >
                                <Table className="w-3 h-3 text-gray-400" />
                                <span className="table-text">{table}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 py-2 px-6">
                            <Table className="w-4 h-4 mx-auto mb-1 opacity-50" />
                            <p className="text-xs">No tables found</p>
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogPanel;
