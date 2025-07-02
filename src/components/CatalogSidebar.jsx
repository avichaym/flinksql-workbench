import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';

const CatalogSidebar = ({ sessionInfo, onExecuteQuery, isExecuting }) => {
  const [catalogs, setCatalogs] = useState([]);
  const [currentCatalog, setCurrentCatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCatalogs, setExpandedCatalogs] = useState(new Set());

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
    }
  }, [sessionInfo.isActive, sessionInfo.sessionHandle]);

  const loadCatalogs = async () => {
    if (isExecuting) return; // Don't load if another query is executing
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📚 Loading catalogs...');
      const result = await onExecuteQuery('SHOW CATALOGS;', true); // true = silent execution
      
      if (result.status === 'FINISHED' && result.results) {
        const catalogList = result.results.map(row => {
          // Handle both array format [["catalog_name"]] and object format
          if (Array.isArray(row)) {
            return row[0]; // First column is catalog name
          } else if (row.fields) {
            return row.fields[0]; // First field is catalog name
          } else {
            // Object format - find the catalog name field
            const catalogField = Object.values(row)[0];
            return catalogField;
          }
        }).filter(Boolean);
        
        console.log('Loaded catalogs:', catalogList);
        setCatalogs(catalogList);
      } else {
        console.warn('Failed to load catalogs:', result);
        setError('Failed to load catalogs');
      }
    } catch (err) {
      console.error('Error loading catalogs:', err);
      setError('Error loading catalogs: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentCatalog = async () => {
    if (isExecuting) return;
    
    try {
      console.log('Loading current catalog...');
      const result = await onExecuteQuery('SHOW CURRENT CATALOG;', true);
      
      if (result.status === 'FINISHED' && result.results && result.results.length > 0) {
        let currentCat;
        const row = result.results[0];
        
        if (Array.isArray(row)) {
          currentCat = row[0];
        } else if (row.fields) {
          currentCat = row.fields[0];
        } else {
          currentCat = Object.values(row)[0];
        }
        
        console.log('Current catalog:', currentCat);
        setCurrentCatalog(currentCat);
      }
    } catch (err) {
      console.error('Error loading current catalog:', err);
    }
  };

  const handleCatalogDoubleClick = async (catalogName) => {
    if (isExecuting || catalogName === currentCatalog) return;
    
    try {
      console.log(`🔄 Switching to catalog: ${catalogName}`);
      const result = await onExecuteQuery(`USE CATALOG ${catalogName};`, false);
      
      if (result.status === 'FINISHED') {
        setCurrentCatalog(catalogName);
        console.log(`Switched to catalog: ${catalogName}`);
      } else {
        console.error('Failed to switch catalog:', result);
      }
    } catch (err) {
      console.error('Error switching catalog:', err);
    }
  };

  const handleRefresh = () => {
    if (!isExecuting && sessionInfo.isActive) {
      loadCatalogs();
      loadCurrentCatalog();
    }
  };

  const toggleCatalogExpansion = (catalogName) => {
    const newExpanded = new Set(expandedCatalogs);
    if (newExpanded.has(catalogName)) {
      newExpanded.delete(catalogName);
    } else {
      newExpanded.add(catalogName);
    }
    setExpandedCatalogs(newExpanded);
  };

  if (!sessionInfo.isActive) {
    return (
      <div className="catalog-sidebar">
        <div className="sidebar-header">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">Catalogs</h3>
          </div>
        </div>
        <div className="sidebar-content">
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
    <div className="catalog-sidebar">
      <div className="sidebar-header">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold">Catalogs</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading || isExecuting}
          className="p-1 hover:bg-gray-700 rounded disabled:opacity-50"
          title="Refresh Catalogs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="sidebar-content">
        {error && (
          <div className="error-message text-xs p-2 mb-2">
            {error}
          </div>
        )}

        {isLoading ? (
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
                  className={`catalog-name ${catalog === currentCatalog ? 'active' : ''} ${isExecuting ? 'disabled' : ''}`}
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
                    <div className="text-xs text-gray-400 px-6 py-1">
                      {catalog === currentCatalog ? 'Current catalog' : 'Double-click to switch'}
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

export default CatalogSidebar;
