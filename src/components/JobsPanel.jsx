import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, RefreshCw, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { useStatementExecution } from '../hooks/useStatementExecution';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('JobsPanel');

const JobsPanel = ({ sessionInfo }) => {
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
  } = useStatementExecution('JobsPanel');

  const loadJobs = useCallback(async () => {
    if (!sessionInfo.isActive || isLoadingJobs) return;
    
    setIsLoadingJobs(true);
    setError(null);
    
    try {
      log.debug('loadJobs', 'Loading Flink jobs...');
      const result = await executeJobsSQL('SHOW JOBS;', { silent: false });
      
      log.debug('loadJobs', 'Jobs query result', { result });
      
      if (result?.status === 'FINISHED' || result?.status === 'COMPLETED') {
        // Handle both direct results and nested state results
        const jobResults = result.results || (result.state && result.state.results) || [];
        
        log.info('loadJobs', 'Extracted job results', { 
          jobCount: jobResults.length, 
          hasResults: jobResults.length > 0 
        });
        
        if (jobResults.length > 0) {
          // Parse job data - Flink SHOW JOBS returns: [job_id, job_name, status, start_time, ...]
          const jobsList = jobResults.map((row, index) => {
            // Handle different result formats
            let id, name, status, startTime;
            
            if (Array.isArray(row)) {
              // Array format: [job_id, job_name, status, start_time]
              [id, name, status, startTime] = row;
            } else if (row.fields && Array.isArray(row.fields)) {
              // Object with fields array
              [id, name, status, startTime] = row.fields;
            } else {
              // Object with field_0, field_1, etc.
              id = row.field_0 || row['job id'];
              name = row.field_1 || row['job name'];
              status = row.field_2 || row.status;
              startTime = row.field_3 || row['start time'];
            }
            
            return {
              id: id || `job-${index}`,
              name: name || 'Unknown Job',
              status: status || 'UNKNOWN',
              startTime: startTime || null
            };
          });
          
          log.info('loadJobs', 'Parsed jobs successfully', { 
            parsedJobs: jobsList.length,
            jobs: jobsList 
          });
          setJobs(jobsList);
        } else {
          log.info('loadJobs', 'No jobs found');
          setJobs([]);
        }
      } else {
        log.warn('loadJobs', 'Jobs query failed', { result });
        setError(result?.error || 'Failed to load jobs');
      }
    } catch (err) {
      log.error('loadJobs', `Error loading jobs: ${err.message}`, { 
        error: err.stack 
      });
      setError('Error loading jobs: ' + err.message);
      setJobs([]);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [sessionInfo.isActive, executeJobsSQL]); // Remove isLoadingJobs from dependencies to avoid circular reference

  // Load jobs when session becomes active
  useEffect(() => {
    if (sessionInfo.isActive && sessionInfo.sessionHandle) {
      loadJobs();
      // Set up periodic refresh every 30 seconds
      const interval = setInterval(loadJobs, 30000);
      return () => clearInterval(interval);
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
      log.info('handleRefresh', 'Refresh event received from title bar');
      loadJobs();
    };

    window.addEventListener('refreshJobs', handleRefresh);
    return () => window.removeEventListener('refreshJobs', handleRefresh);
  }, [loadJobs]); // Use loadJobs as dependency

  const stopJob = async (jobId) => {
    if (stoppingJobs.has(jobId)) return;
    
    setStoppingJobs(prev => new Set(prev).add(jobId));
    
    try {
      log.info('stopJob', `Stopping job: ${jobId}`);
      const result = await executeJobsSQL(`STOP JOB '${jobId}';`, { silent: false });
      
      if (result?.status === 'FINISHED' || result?.status === 'COMPLETED') {
        log.info('stopJob', `Job stopped successfully`, { jobId });
        // Refresh jobs list after a short delay
        setTimeout(loadJobs, 1000);
      } else {
        log.error('stopJob', `Failed to stop job`, { jobId, result });
        setError(result?.error || 'Failed to stop job');
      }
    } catch (err) {
      log.error('stopJob', `Error stopping job: ${err.message}`, { 
        jobId, 
        error: err.stack 
      });
      setError('Error stopping job: ' + err.message);
    } finally {
      setStoppingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const getJobStatusIcon = (status) => {
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
      case 'SCHEDULED':
        return <Clock className="w-3 h-3 text-yellow-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-400" />;
    }
  };

  const getJobStatusColor = (status) => {
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
      case 'SCHEDULED':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatStartTime = (startTime) => {
    if (!startTime) return 'Unknown';
    
    try {
      const date = new Date(startTime);
      return date.toLocaleString();
    } catch (err) {
      return startTime.toString();
    }
  };

  if (!sessionInfo.isActive) {
    return (
      <div className="jobs-panel-content">
        <div className="jobs-panel-body">
          <div className="text-center text-gray-400 py-8">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active session</p>
            <p className="text-xs mt-1">Start a session to view jobs</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-panel-content">
      <div className="jobs-panel-body">
        {error && (
          <div className="error-message text-xs p-2 mb-2">
            {error}
          </div>
        )}

        {isLoadingJobs ? (
          <div className="text-center text-gray-400 py-4">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <Zap className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No jobs found</p>
            <p className="text-xs mt-1">Jobs will appear here when running</p>
          </div>
        ) : (
          <div className="jobs-list">
            {jobs.map((job) => (
              <div key={job.id} className="job-item">
                <div className="job-header">
                  <div className="job-status">
                    {getJobStatusIcon(job.status)}
                    <span className={`job-status-text ${getJobStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  {(job.status === 'RUNNING' || job.status === 'CREATED') && (
                    <button
                      onClick={() => stopJob(job.id)}
                      disabled={stoppingJobs.has(job.id)}
                      className="btn-icon-only btn-danger"
                      title={`Stop job ${job.id}`}
                    >
                      {stoppingJobs.has(job.id) ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
                <div className="job-details">
                  <div className="job-name" title={job.name}>
                    {job.name}
                  </div>
                  <div className="job-id text-xs text-gray-400" title={job.id}>
                    ID: {job.id}
                  </div>
                  <div className="job-start-time text-xs text-gray-400">
                    Started: {formatStartTime(job.startTime)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsPanel;
