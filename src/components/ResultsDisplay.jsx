import React from 'react';
import { CheckCircle, XCircle, Clock, Database } from 'lucide-react';

const ResultsDisplay = ({ result, isExecuting }) => {
  if (isExecuting) {
    return (
      <div className="results-content">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Clock className="w-8 h-8 mx-auto mb-4 animate-spin text-orange-500" />
            <p className="text-lg">Executing query...</p>
            <p className="text-sm text-gray-400 mt-2">Please wait while your SQL statement is processed</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-content">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg">Ready to execute</p>
            <p className="text-sm mt-2">Write your Flink SQL query and click Execute or press Ctrl+Enter</p>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'ERROR') {
    return (
      <div className="results-content">
        <div className="error-message">
          <div className="flex items-center mb-3">
            <XCircle className="w-5 h-5 mr-2" />
            <strong>Execution Error</strong>
          </div>
          
          {/* Main error message */}
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
            <p className="text-red-300 font-medium">{result.error}</p>
          </div>

          {/* Detailed error information */}
          {result.errorDetails && (
            <div className="space-y-3">
              {/* Flink-specific error details */}
              {result.errorDetails.flinkError && (
                <div className="bg-gray-800 rounded p-3">
                  <h4 className="text-sm font-semibold mb-2 text-yellow-400">Flink Error Details:</h4>
                  {result.errorDetails.flinkErrorMessage && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-400">Message:</span>
                      <p className="text-sm text-red-300">{result.errorDetails.flinkErrorMessage}</p>
                    </div>
                  )}
                  {result.errorDetails.flinkErrorCode && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-400">Error Code:</span>
                      <p className="text-sm text-orange-300">{result.errorDetails.flinkErrorCode}</p>
                    </div>
                  )}
                  {result.errorDetails.flinkError.errors && result.errorDetails.flinkError.errors.length > 1 && (
                    <div>
                      <span className="text-xs text-gray-400">Additional Errors:</span>
                      <div className="mt-1 space-y-1">
                        {result.errorDetails.flinkError.errors.slice(1).map((err, idx) => (
                          <div key={idx} className="text-xs text-red-300 pl-2 border-l border-red-500/30">
                            {err.message} {err.code && `(${err.code})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HTTP error details */}
              {result.errorDetails.httpStatus && (
                <div className="bg-gray-800 rounded p-3">
                  <h4 className="text-sm font-semibold mb-2 text-yellow-400">HTTP Error:</h4>
                  <div className="text-sm">
                    <span className="text-gray-400">Status:</span> 
                    <span className="text-orange-300 ml-1">{result.errorDetails.httpStatus}</span>
                    {result.errorDetails.httpStatusText && (
                      <span className="text-gray-300 ml-1">({result.errorDetails.httpStatusText})</span>
                    )}
                  </div>
                </div>
              )}

              {/* Session information */}
              {result.errorDetails.sessionHandle && (
                <div className="bg-gray-800 rounded p-3">
                  <h4 className="text-sm font-semibold mb-2 text-yellow-400">Session Info:</h4>
                  <div className="text-xs text-gray-400 font-mono">
                    Session: {result.errorDetails.sessionHandle.substring(0, 16)}...
                  </div>
                </div>
              )}

              {/* Raw error body (if available and not already parsed) */}
              {result.errorDetails.rawErrorBody && !result.errorDetails.flinkError && (
                <div className="bg-gray-800 rounded p-3">
                  <h4 className="text-sm font-semibold mb-2 text-yellow-400">Raw Error Response:</h4>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-auto max-h-32">
                    {result.errorDetails.rawErrorBody}
                  </pre>
                </div>
              )}

              {/* Timestamp */}
              {result.errorDetails.timestamp && (
                <div className="text-xs text-gray-500">
                  Error occurred at: {new Date(result.errorDetails.timestamp).toLocaleString()}
                </div>
              )}

              {/* Expandable stack trace */}
              {result.errorDetails.stack && (
                <details className="bg-gray-800 rounded p-3">
                  <summary className="text-sm font-semibold text-yellow-400 cursor-pointer hover:text-yellow-300">
                    Stack Trace (click to expand)
                  </summary>
                  <pre className="text-xs text-gray-400 mt-2 whitespace-pre-wrap overflow-auto max-h-40">
                    {result.errorDetails.stack}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (result.status === 'FINISHED') {
    const hasResults = result.results && result.results.length > 0;
    const hasColumns = result.columns && result.columns.length > 0;

    // Only log once when result changes, not on every render
    React.useEffect(() => {
      console.log(`ResultsDisplay analysis:`, {
        hasResults,
        hasColumns,
        resultKind: result.resultKind,
        resultsLength: result.results?.length,
        columnsLength: result.columns?.length,
        sampleResult: result.results?.[0],
        allResults: result.results,
        allColumns: result.columns
      });
    }, [result]);

    return (
      <div className="results-content">
        <div className="success-message">
          <div className="flex items-center mb-2">
            <CheckCircle className="w-5 h-5 mr-2" />
            <strong>Query executed successfully</strong>
          </div>
          {result.jobId && (
            <p className="text-sm">Job ID: {result.jobId}</p>
          )}
          {result.resultKind && (
            <p className="text-sm">Result: {result.resultKind}</p>
          )}
        </div>

        {hasResults && hasColumns ? (
          <div className="overflow-auto">
            <table className="results-table">
              <thead>
                <tr>
                  {result.columns.map((column, index) => (
                    <th key={index}>
                      {column.name}
                      <div className="text-xs text-gray-400 font-normal">
                        {column.logicalType?.type || 'UNKNOWN'}
                        {column.logicalType?.nullable === false && ' NOT NULL'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.results.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.fields ? (
                      // Handle standard fields array format
                      row.fields.map((field, fieldIndex) => (
                        <td key={fieldIndex}>
                          {field !== null ? String(field) : <span className="text-gray-500">NULL</span>}
                        </td>
                      ))
                    ) : (
                      // Handle direct object format (like SHOW TABLES)
                      result.columns.map((column, colIndex) => (
                        <td key={colIndex}>
                          {row[column.name] !== undefined ? 
                            String(row[column.name]) : 
                            <span className="text-gray-500">NULL</span>
                          }
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-sm text-gray-400">
              Showing {result.results.length} row{result.results.length !== 1 ? 's' : ''}
            </div>
          </div>
        ) : hasResults && !hasColumns ? (
          // Handle results without column metadata
          <div className="overflow-auto">
            <div className="bg-gray-800 rounded p-4">
              <h4 className="text-sm font-semibold mb-2">Raw Results:</h4>
              <pre className="text-xs text-green-400 whitespace-pre-wrap">
                {JSON.stringify(result.results, null, 2)}
              </pre>
            </div>
            <div className="mt-4 text-sm text-gray-400">
              {result.results.length} result item{result.results.length !== 1 ? 's' : ''}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-8">
            <p>Query executed successfully but returned no data to display.</p>
            {result.resultKind === 'SUCCESS_WITH_CONTENT' && (
              <p className="text-sm mt-2">This might be a DDL statement or an INSERT operation.</p>
            )}
            <div className="mt-4 text-xs bg-gray-800 rounded p-3">
              <strong>Debug Info:</strong>
              <div>• Has Results: {hasResults ? 'Yes' : 'No'}</div>
              <div>• Has Columns: {hasColumns ? 'Yes' : 'No'}</div>
              <div>• Result Kind: {result.resultKind || 'Unknown'}</div>
              <div>• Results Length: {result.results?.length || 0}</div>
              <div>• Columns Length: {result.columns?.length || 0}</div>
              {result.results && result.results.length > 0 && (
                <div className="mt-2">
                  <strong>Sample Data:</strong>
                  <pre className="text-xs mt-1 bg-black p-2 rounded">
                    {JSON.stringify(result.results[0], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="results-content">
      <div className="text-center text-gray-400">
        <p>Unknown execution status: {result.status}</p>
      </div>
    </div>
  );
};

export default ResultsDisplay;
