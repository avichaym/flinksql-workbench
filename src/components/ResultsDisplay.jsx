import React, { useEffect, useState, useRef } from 'react';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ResultsDisplay');

const ResultsDisplay = ({ result, isExecuting }) => {
  // State to track accumulated results
  const [resultsMatrix, setResultsMatrix] = useState({
    columns: [],
    rows: [],
    resultType: '',
    resultKind: '',
    lastUpdateTime: null,
    wasCancelled: false
  });
  
  // Track UI state
  const [displayedRowCount, setDisplayedRowCount] = useState(0);
  const [newRowsAdded, setNewRowsAdded] = useState(false);
  const animationTimerRef = useRef(null);
  const lastResultRef = useRef(null);
  
  // Always have these basic values available for rendering
  const resultType = result?.resultType || '';
  const resultKind = result?.resultKind || '';
  const isCancelled = resultType === 'CANCELLED' || 
                      result?.status === 'CANCELLED' || 
                      result?.currentStatus === 'CANCELLED' ||
                      result?.wasCancelled === true ||
                      resultsMatrix.wasCancelled === true;
  const hasResults = result?.results && result.results.length > 0;
  const hasColumns = result?.columns && result.columns.length > 0;
  
  // Update our results matrix when new data arrives
  useEffect(() => {
    if (!result) return;
    
    // Store for logging/debugging
    lastResultRef.current = result;
    
    log.debug('useEffect', 'ResultsDisplay received update', {
      resultType: result.resultType,
      resultKind: result.resultKind,
      status: result.status,
      isCancelled,
      hasResults,
      hasColumns,
      rowCount: result.results?.length || 0
    });
    
    // If cancelled, we'll keep displaying the data we have
    if (isCancelled) {
      log.debug('useEffect', 'Query was cancelled - keeping existing result data');
      setResultsMatrix(prev => ({
        ...prev,
        resultType: 'CANCELLED',
        resultKind: 'CANCELLED',
        wasCancelled: true,
        lastUpdateTime: new Date().toLocaleTimeString()
      }));
      return;
    }
    
    // Only update the matrix if we have actual result data
    if (hasResults && hasColumns) {
      // Check if we have new rows to highlight
      if (result.results.length > displayedRowCount) {
        setNewRowsAdded(true);
        
        // Clear any existing timeout
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }
        
        // Clear the animation flag after 1.5 seconds
        animationTimerRef.current = setTimeout(() => {
          setNewRowsAdded(false);
        }, 1500);
        
        // Update displayed row count
        setDisplayedRowCount(result.results.length);
      }
      
      // Always update our matrix with the latest data
      setResultsMatrix({
        columns: result.columns,
        rows: result.results,
        resultType: result.resultType || resultsMatrix.resultType,
        resultKind: result.resultKind || resultsMatrix.resultKind,
        lastUpdateTime: new Date().toLocaleTimeString()
      });
    }
    
    // Always keep these metadata fields updated
    if (result.resultType && result.resultType !== 'EOS') {
      setResultsMatrix(prev => ({...prev, resultType: result.resultType}));
    }
    
    if (result.resultKind) {
      setResultsMatrix(prev => ({...prev, resultKind: result.resultKind}));
    }
  }, [result, isCancelled, hasResults, hasColumns, displayedRowCount]);
  
  // Cleanup animation timer on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);
  
  // Display values - show most meaningful info based on state
  const displayResultType = isCancelled ? 'CANCELLED' : 
                            (resultType === 'EOS' && resultsMatrix.resultType) ? resultsMatrix.resultType : 
                            resultType || resultsMatrix.resultType;
                            
  const displayResultKind = isCancelled ? 'CANCELLED' : 
                           resultKind || resultsMatrix.resultKind;

  return (
    <div className="results-content">
      {/* EXACT format requested by user - ALWAYS show these 3 fields */}
      <div className="mb-4 space-y-2 flex-shrink-0">{/* Made header non-shrinking */}
        <div className="text-lg">
          <span className="font-semibold">Result Type:</span>
          <span className={`ml-2 ${isCancelled ? 'text-amber-400' : 'text-blue-300'}`}>
            {displayResultType}
          </span>
          {isExecuting && !isCancelled && (
            <span className="ml-2 text-yellow-300 text-sm animate-pulse">
              (Running...)
            </span>
          )}
          &nbsp;&nbsp;&nbsp;
          <span className="font-semibold">Result Kind:</span>
          <span className={`ml-2 ${isCancelled ? 'text-amber-400' : 'text-green-300'}`}>
            {displayResultKind}
          </span>
        </div>
        <div className="text-lg font-semibold mt-4">
          Content:
          {isCancelled && (
            <span className="ml-2 text-sm text-amber-400">
              (Query cancelled - showing partial results)
            </span>
          )}
          {isExecuting && !isCancelled && resultsMatrix.rows.length > 0 && (
            <span className={`text-sm font-normal ml-2 ${newRowsAdded ? 'text-yellow-300 animate-pulse' : 'text-gray-400'}`}>
              {newRowsAdded 
                ? `(New data received! ${displayedRowCount} rows total)`
                : `(${displayedRowCount} rows so far...)`
              }
            </span>
          )}
          {!isExecuting && !isCancelled && resultsMatrix.rows.length > 0 && (
            <span className="text-sm font-normal text-gray-400 ml-2">
              (Final result: {resultsMatrix.rows.length} rows)
            </span>
          )}
          {resultsMatrix.lastUpdateTime && (
            <span className="text-xs text-gray-500 ml-2">
              (Last updated: {resultsMatrix.lastUpdateTime})
            </span>
          )}
        </div>
      </div>

      {/* Content Table - show if either the result or our matrix has data */}
      {((hasResults && hasColumns) || (resultsMatrix.rows.length > 0 && resultsMatrix.columns.length > 0)) && (
        <div className="results-container flex-1 min-h-0">{/* Make it take remaining space and allow shrinking */}
          <div className="results-table-container">
            <table className="results-table w-full">
              <thead className="bg-gray-800">
                <tr>
                  {/* Use either current columns or stored columns */}
                  {(result?.columns || resultsMatrix.columns).map((column, index) => (
                    <th key={index} className="px-4 py-2 text-left border-b border-gray-600">
                      <div className="font-semibold">{column.name}</div>
                      <div className="text-xs text-gray-400 font-normal">
                        {column.logicalType?.type || 'UNKNOWN'}
                        {column.logicalType?.nullable === false && ' NOT NULL'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Use either current results or stored results */}
                {(isCancelled ? resultsMatrix.rows : (result?.results || resultsMatrix.rows)).map((row, rowIndex) => {
                  // Highlight newest rows when new data is received
                  const isNewRow = newRowsAdded && result?.newRowCount && 
                    rowIndex >= ((result?.results?.length || 0) - (result?.newRowCount || 0));
                    
                  return (
                    <tr 
                      key={rowIndex} 
                      className={`border-b border-gray-700 hover:bg-gray-800 
                        ${isNewRow ? 'bg-green-900/20 animate-pulse' : ''}
                        ${isCancelled ? 'opacity-90' : ''}`}
                    >
                      {row.fields ? (
                        // Handle standard fields array format
                      row.fields.map((field, fieldIndex) => (
                        <td key={fieldIndex} className="px-4 py-2">
                          {field !== null ? String(field) : <span className="text-gray-500 italic">NULL</span>}
                        </td>
                      ))
                    ) : (
                      // Handle object format - try column name first, then generic field names
                      (result?.columns || resultsMatrix.columns).map((column, colIndex) => {
                        let value;
                        if (row[column.name] !== undefined) {
                          // Direct column name match
                          value = row[column.name];
                        } else if (row[`field_${colIndex}`] !== undefined) {
                          // Generic field name (field_0, field_1, etc.)
                          value = row[`field_${colIndex}`];
                        } else {
                          // Try to find by index in case it's a different naming scheme
                          const fieldKeys = Object.keys(row);
                          value = fieldKeys[colIndex] ? row[fieldKeys[colIndex]] : undefined;
                        }
                        
                        return (
                          <td key={colIndex} className="px-4 py-2">
                            {value !== undefined && value !== null ? 
                              String(value) : 
                              <span className="text-gray-500 italic">NULL</span>
                            }
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="mt-2 text-sm text-gray-400 flex items-center justify-between px-2">
            <span>
              {isCancelled ? resultsMatrix.rows.length : (result?.results?.length || resultsMatrix.rows.length)} 
              row{(result?.results?.length || resultsMatrix.rows.length) !== 1 ? 's' : ''}
            </span>
            {isCancelled && (
              <span className="text-amber-400 text-xs">
                Query execution was cancelled by user
              </span>
            )}
          </div>
        </div>
      )}

      {/* Show when no results are available */}
      {!hasResults && resultsMatrix.rows.length === 0 && (
        <div className="flex-1 min-h-0 p-4 border border-gray-700 rounded bg-gray-800/50 text-center flex items-center justify-center">
          {isCancelled ? (
            <p className="text-amber-400">Query was cancelled before any results were received</p>
          ) : isExecuting ? (
            <p className="text-yellow-300">Executing query, waiting for results...</p>
          ) : (
            <p className="text-gray-400">No results to display</p>
          )}
        </div>
      )}

      {/* Show errors if present */}
      {(result?.status === 'ERROR' || result?.error) && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded flex-shrink-0">
          <p className="text-red-300 font-medium">{result.error || "An error occurred during execution"}</p>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;
