import React, { useState, useEffect } from 'react';
import { Code, Search, Copy, RefreshCw } from 'lucide-react';
import yaml from 'js-yaml';
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('SnippetsPanel');

const SnippetsPanel = ({ onInsertSnippet }) => {
  const [snippets, setSnippets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load snippets from YAML file
  const loadSnippets = async () => {
    log.traceEnter('loadSnippets');
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/snippets.yaml');
      if (!response.ok) {
        throw new Error(`Failed to load snippets: ${response.status} ${response.statusText}`);
      }
      const yamlText = await response.text();
      const data = yaml.load(yamlText);
      
      setSnippets(data.snippets || []);
      log.info('loadSnippets', `Loaded ${data.snippets?.length || 0} snippets`);
    } catch (err) {
      log.error('loadSnippets', `Failed to load snippets: ${err.message}`);
      setError(err.message);
    } finally {
      setIsLoading(false);
      log.traceExit('loadSnippets');
    }
  };

  // Load snippets on component mount
  useEffect(() => {
    loadSnippets();
  }, []);

  // Filter snippets based on search only (name only now)
  const filteredSnippets = snippets.filter(snippet => {
    if (searchTerm === '') return true;
    
    const searchLower = searchTerm.toLowerCase();
    return snippet.name.toLowerCase().includes(searchLower);
  });

  // Copy snippet to clipboard
  const copyToClipboard = async (sql) => {
    log.traceEnter('copyToClipboard');
    
    try {
      await navigator.clipboard.writeText(sql);
      log.info('copyToClipboard', 'Snippet copied to clipboard');
    } catch (err) {
      log.error('copyToClipboard', `Failed to copy to clipboard: ${err.message}`);
    }
    
    log.traceExit('copyToClipboard');
  };

  // Insert snippet into editor
  const insertSnippet = (snippet) => {
    log.traceEnter('insertSnippet', { snippetName: snippet.name });
    
    if (onInsertSnippet) {
      onInsertSnippet(snippet.sql);
      log.info('insertSnippet', `Inserted snippet: ${snippet.name}`);
    }
    
    log.traceExit('insertSnippet');
  };

  return (
    <div className="snippets-panel-content">
      {/* Header with just reload button */}


      {/* Body */}
      <div className="snippets-panel-body">
        {/* Search */}
        <div className="snippets-search-container">
          <div className="snippets-search-wrapper">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search snippets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="snippets-search-input"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="snippets-error">
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="snippets-loading">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <div className="text-sm">Loading snippets...</div>
          </div>
        ) : (
          <div className="snippets-content">
            {filteredSnippets.map((snippet, index) => (
              <div key={index} className="snippet-item-compact">
                <div className="snippet-compact-header">
                  <span className="snippet-name-compact">{snippet.name}</span>
                  <div className="snippet-actions">
                    <button
                      onClick={() => copyToClipboard(snippet.sql)}
                      className="snippet-action-btn"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => insertSnippet(snippet)}
                      className="snippet-action-btn snippet-insert-btn"
                      title="Insert into editor"
                    >
                      <Code className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredSnippets.length === 0 && !isLoading && (
              <div className="snippets-empty">
                <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">
                  {searchTerm 
                    ? 'No snippets match your search'
                    : 'No snippets available'
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="snippets-footer">
          {snippets.length > 0 && (
            <div>
              {filteredSnippets.length} of {snippets.length} snippets
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnippetsPanel;
