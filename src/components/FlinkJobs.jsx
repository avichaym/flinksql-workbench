import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { useStatementExecution } from '../hooks/useStatementExecution';
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('FlinkJobs');

const FlinkJobs = ({ sessionInfo }) => {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [stoppingJobs, setStoppingJobs] = useState(new Set());
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Use dedicated statement execution for jobs operations
  const {
    executeSQL: executeJobsSQL,
    isExecuting: isJobsLoading,
    result: jobsResult,
    error: jobsError
  } = useStatementExecution('FlinkJobs');

  // Load jobs when session becomes active
  useEffect(() => {
    if (sessionInfo.isActive && sessionInfo.sessionHandle) {
      loadJobs();
      // Auto-refresh disabled - jobs will only refresh manually or when session changes
    } else {
      // Clear jobs when session is inactive
      setJobs([]);
      setError(null);
      setStoppingJobs(new Set());
      setIsLoadingJobs(false);
    }
  }, [sessionInfo.isActive, sessionInfo.sessionHandle]);

  // Listen for refresh events from title bar button
  useEffect(() => {
    const handleRefresh = () => {
      log.info('refreshJobs', 'Refresh event received from title bar');
      loadJobs();
    };

    window.addEventListener('refreshJobs', handleRefresh);
    return () => window.removeEventListener('refreshJobs', handleRefresh);
  }, []);

  const loadJobs = async () => {
    if (!sessionInfo.isActive || isLoadingJobs) return;
    
    setIsLoadingJobs(true);
    setError(null);
    
    try {
      log.info('loadJobs', 'Loading Flink jobs...');
      const result = await executeJobsSQL('SHOW JOBS;', { silent: false });
      
      log.debug('loadJobs', 'Jobs query result', { result });
      log.debug('loadJobs', 'Jobs query status', { status: result?.status });
      log.debug('loadJobs', 'Jobs query results', { results: result?.results });
      log.debug('loadJobs', 'Current jobs state before update', { count: jobs.length });
      
      if ((result.status === 'FINISHED' || result.status === 'COMPLETED') && result.results) {
        if (result.results.length === 0) {
          log.info('loadJobs', 'No jobs found in results');
          setJobs([]);
          return;
        }
        
        // Parse jobs from results
        const jobsList = result.results.map((row, index) => {
          log.debug('loadJobs', `Processing job row ${index}`, { row });
          
          let jobId, jobName, status, startTime;
          
          if (Array.isArray(row)) {
            // Handle array format
            jobId = row[0];
            jobName = row[1];
            status = row[2];
            startTime = row[3];
          } else if (row.fields) {
            // Handle object format with fields array
            jobId = row.fields[0];
            jobName = row.fields[1];
            status = row.fields[2];
            startTime = row.fields[3];
          } else {
            // Handle object format with named properties
            const jobField = Object.keys(row).find(key => 
              key.toLowerCase().includes('job') && key.toLowerCase().includes('id')
            ) || Object.keys(row).find(key => key === 'field_0'); // field_0 is typically job ID
            
            const nameField = Object.keys(row).find(key => 
              key.toLowerCase().includes('name')
            ) || Object.keys(row).find(key => key === 'field_1'); // field_1 is typically job name
            
            const statusField = Object.keys(row).find(key => 
              key.toLowerCase().includes('status')
            ) || Object.keys(row).find(key => key === 'field_2'); // field_2 is typically status
            
            const timeField = Object.keys(row).find(key => 
              key.toLowerCase().includes('start') || key.toLowerCase().includes('time')
            ) || Object.keys(row).find(key => key === 'field_3'); // field_3 is typically start time
            
            jobId = jobField ? row[jobField] : `job-${index}`;
            jobName = nameField ? row[nameField] : 'Unknown Job';
            status = statusField ? row[statusField] : 'unknown';
            startTime = timeField ? row[timeField] : null;
          }
          
          const parsedJob = {
            id: jobId,
            name: jobName || 'Unknown Job',
            status: status?.toUpperCase() || 'UNKNOWN',
            startTime: startTime
          };
          
          log.debug('loadJobs', `Parsed job ${index}`, { parsedJob });
          return parsedJob;
        });
        
        log.info('loadJobs', 'Final parsed jobs', { 
          jobCount: jobsList.length,
          jobs: jobsList 
        });
        setJobs(jobsList);
        return; // Important: return here to avoid processing alternative paths
      } else if ((result.status === 'FINISHED' || result.status === 'COMPLETED') && !result.results) {
        // Query finished but no results property - try alternative locations
        log.debug('loadJobs', 'Query finished but no results property, checking alternative locations...');
        log.debug('loadJobs', 'Full result object', { result });
        
        // Check if results are in a different property
        let alternativeResults = null;
        if (result.data) {
          alternativeResults = result.data;
        } else if (result.state && result.state.data) {
          alternativeResults = result.state.data;
        } else if (result.state && result.state.results) {
          alternativeResults = result.state.results;
        }
        
        if (alternativeResults && alternativeResults.length > 0) {
          log.debug('loadJobs', 'Found results in alternative location', { 
            alternativeResults 
          });
          // Parse the alternative results
          const jobsList = alternativeResults.map((row, index) => {
            log.debug('loadJobs', `Processing alternative job row ${index}`, { row });
            
            let jobId, jobName, status, startTime;
            
            if (Array.isArray(row)) {
              jobId = row[0];
              jobName = row[1];
              status = row[2];
              startTime = row[3];
            } else if (row.fields) {
              jobId = row.fields[0];
              jobName = row.fields[1];
              status = row.fields[2];
              startTime = row.fields[3];
            } else {
              const jobField = Object.keys(row).find(key => 
                key.toLowerCase().includes('job') && key.toLowerCase().includes('id')
              ) || Object.keys(row).find(key => key === 'field_0'); // field_0 is typically job ID
              
              const nameField = Object.keys(row).find(key => 
                key.toLowerCase().includes('name')
              ) || Object.keys(row).find(key => key === 'field_1'); // field_1 is typically job name
              
              const statusField = Object.keys(row).find(key => 
                key.toLowerCase().includes('status')
              ) || Object.keys(row).find(key => key === 'field_2'); // field_2 is typically status
              
              const timeField = Object.keys(row).find(key => 
                key.toLowerCase().includes('start') || key.toLowerCase().includes('time')
              ) || Object.keys(row).find(key => key === 'field_3'); // field_3 is typically start time
              
              jobId = jobField ? row[jobField] : `job-${index}`;
              jobName = nameField ? row[nameField] : 'Unknown Job';
              status = statusField ? row[statusField] : 'unknown';
              startTime = timeField ? row[timeField] : null;
            }
            
            return {
              id: jobId,
              name: jobName || 'Unknown Job',
              status: status?.toUpperCase() || 'UNKNOWN',
              startTime: startTime
            };
          });
          
          log.debug('loadJobs', 'Final parsed jobs from alternative location', { jobCount: jobsList.length, jobs: jobsList });
          setJobs(jobsList);
        } else {
          setJobs([]);
        }
      } else if (result.status === 'RUNNING') {
        // Query is still running, keep current jobs
        log.debug('loadJobs', 'Query still running, maintaining current jobs');
        return;
      } else if (result.status === 'ERROR') {
        log.error('loadJobs', 'Error loading jobs', { error: result.error });
        setError(result.error?.message || 'Failed to load jobs');
        setJobs([]);
      } else {
        log.warn('loadJobs', 'Unexpected result status', { status: result.status });
        // For any other status, check if we can extract job count for debugging
        const resultCount = result.resultCount || result.state?.resultCount || 0;
        log.debug('loadJobs', 'Result count from unexpected status', { resultCount, status: result.status });
        
        if (resultCount > 0) {
          log.debug('loadJobs', 'Has result count but unexpected status, trying to find data', { resultCount, status: result.status });
          // Try to find the data in various possible locations
          const possibleDataLocations = [
            result.data,
            result.state?.data,
            result.state?.results,
            result.rows,
            result.state?.rows
          ];
          
          for (const dataLocation of possibleDataLocations) {
            if (dataLocation && Array.isArray(dataLocation) && dataLocation.length > 0) {
              log.debug('loadJobs', 'Found data in location', { dataLength: dataLocation.length });
              try {
                const jobsList = dataLocation.map((row, index) => {
                  log.trace('loadJobs', `Processing row ${index}`, { row });
                  
                  let jobId, jobName, status, startTime;
                  
                  if (Array.isArray(row)) {
                    jobId = row[0];
                    jobName = row[1];
                    status = row[2];
                    startTime = row[3];
                  } else if (row.fields) {
                    jobId = row.fields[0];
                    jobName = row.fields[1];
                    status = row.fields[2];
                    startTime = row.fields[3];
                  } else {
                    const jobField = Object.keys(row).find(key => 
                      key.toLowerCase().includes('job') && key.toLowerCase().includes('id')
                    ) || Object.keys(row).find(key => key === 'field_0'); // field_0 is typically job ID
                    
                    const nameField = Object.keys(row).find(key => 
                      key.toLowerCase().includes('name')
                    ) || Object.keys(row).find(key => key === 'field_1'); // field_1 is typically job name
                    
                    const statusField = Object.keys(row).find(key => 
                      key.toLowerCase().includes('status')
                    ) || Object.keys(row).find(key => key === 'field_2'); // field_2 is typically status
                    
                    const timeField = Object.keys(row).find(key => 
                      key.toLowerCase().includes('start') || key.toLowerCase().includes('time')
                    ) || Object.keys(row).find(key => key === 'field_3'); // field_3 is typically start time
                    
                    jobId = jobField ? row[jobField] : `job-${index}`;
                    jobName = nameField ? row[nameField] : 'Unknown Job';
                    status = statusField ? row[statusField] : 'unknown';
                    startTime = timeField ? row[timeField] : null;
                  }
                  
                  return {
                    id: jobId,
                    name: jobName || 'Unknown Job',
                    status: status?.toUpperCase() || 'UNKNOWN',
                    startTime: startTime
                  };
                });
                
                log.info('loadJobs', 'Successfully parsed jobs from alternative location', { jobCount: jobsList.length, jobs: jobsList });
                setJobs(jobsList);
                return; // Exit the function since we found and processed the data
              } catch (parseError) {
                log.error('loadJobs', 'Error parsing jobs from alternative location', { error: parseError });
              }
            }
          }
        }
        
        // If we get here, we couldn't find the data anywhere
        setJobs([]);
      }
    } catch (err) {
      log.error('loadJobs', `Exception loading jobs: ${err.message}`, { 
        error: err.stack 
      });
      setError(err.message || 'Failed to load jobs');
      setJobs([]);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const stopJob = async (jobId) => {
    if (!sessionInfo.isActive || stoppingJobs.has(jobId)) return;
    
    setStoppingJobs(prev => new Set([...prev, jobId]));
    
    try {
      log.info('stopJob', `Stopping job: ${jobId}`);
      const result = await executeJobsSQL(`STOP JOB '${jobId}';`, { silent: false });
      
      if (result.status === 'FINISHED') {
        log.info('stopJob', `Job stop command sent successfully`, { jobId });
        // Refresh jobs list after a short delay
        setTimeout(loadJobs, 1000);
      } else if (result.status === 'ERROR') {
        log.error('stopJob', `Error stopping job`, { 
          jobId, 
          error: result.error 
        });
        setError(`Failed to stop job: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      log.error('stopJob', `Exception stopping job: ${err.message}`, { 
        jobId, 
        error: err.stack 
      });
      setError(`Failed to stop job: ${err.message}`);
    } finally {
      setStoppingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'RUNNING':
        return <Play className="w-3 h-3 text-green-400" />;
      case 'FINISHED':
        return <CheckCircle className="w-3 h-3 text-blue-400" />;
      case 'CANCELED':
      case 'CANCELLED':
        return <Square className="w-3 h-3 text-gray-400" />;
      case 'FAILED':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      case 'CREATED':
      case 'INITIALIZING':
        return <Clock className="w-3 h-3 text-yellow-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'RUNNING':
        return 'text-green-400';
      case 'FINISHED':
        return 'text-blue-400';
      case 'CANCELED':
      case 'CANCELLED':
        return 'text-gray-400';
      case 'FAILED':
        return 'text-red-400';
      case 'CREATED':
      case 'INITIALIZING':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const canStopJob = (status) => {
    return status?.toUpperCase() === 'RUNNING';
  };

  const formatStartTime = (startTime) => {
    if (!startTime) return 'Unknown';
    try {
      const date = new Date(startTime);
      return date.toLocaleString();
    } catch (err) {
      return startTime;
    }
  };

  if (!sessionInfo.isActive) {
    return (
      <>
        <div className="sidebar-header">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold">Jobs</h3>
          </div>
        </div>
        <div className="sidebar-content">
          <div className="text-center text-gray-400 py-8">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active session</p>
            <p className="text-xs mt-1">Start a session to view jobs</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sidebar-header">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="font-semibold">Jobs</h3>
        </div>
      </div>

      <div className="sidebar-content">
        {error && (
          <div className="error-message text-xs p-2 mb-2">
            {error}
          </div>
        )}

        {isLoadingJobs ? (
          <div className="text-center text-gray-400 py-4">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading jobs...</p>
            <p className="text-xs">Executing SHOW JOBS query...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <Zap className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No jobs found</p>
            <p className="text-xs mt-1">Submit a streaming job to see it here</p>
            <p className="text-xs mt-1 text-gray-500">Try: INSERT INTO ... SELECT * FROM ...</p>
            <div className="text-xs mt-2 p-2 bg-gray-800 rounded">
              <strong>Debug:</strong> SHOW JOBS returned 0 rows
            </div>
          </div>
        ) : (
          <div className="jobs-list">
            {jobs.map((job) => (
              <div key={job.id} className="job-item">
                <div className="job-header">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <div className="job-name truncate" title={job.name}>
                        {job.name}
                      </div>
                      <div className="job-details-compact text-xs text-gray-400 truncate">
                        <span className={`job-status ${getStatusColor(job.status)}`}>
                          Status: {job.status}
                        </span>
                        <span className="mx-1">•</span>
                        <span className="job-time">
                          Started: {formatStartTime(job.startTime)}
                        </span>
                        <span className="mx-1">•</span>
                        <span className="job-id" title={job.id}>
                          ID: {job.id}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canStopJob(job.status) && (
                    <button
                      onClick={() => stopJob(job.id)}
                      disabled={stoppingJobs.has(job.id)}
                      className="btn-icon-only btn-danger text-xs disabled:opacity-50"
                      title="Stop Job"
                    >
                      {stoppingJobs.has(job.id) ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default FlinkJobs;
