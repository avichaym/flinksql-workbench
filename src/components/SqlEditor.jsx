import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Plus, X } from 'lucide-react';
import logger from '../utils/logger.js';
import themeService from '../services/themeService.js';

const log = logger.getModuleLogger('SqlEditor');

const TABS_CACHE_KEY = 'flink-sql-editor-tabs';
const CACHE_VERSION = '1.0';

const SqlEditor = forwardRef(({ value, onChange, onExecute, isExecuting }, ref) => {
  const editorRef = useRef(null);
  const [tabs, setTabs] = useState([]);
  const [nextTabId, setNextTabId] = useState(2);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(themeService.getCurrentTheme());

  // Map application themes to Monaco Editor themes
  const getMonacoTheme = useCallback((appTheme) => {
    const theme = themeService.getTheme(appTheme);
    // Use Monaco's built-in themes based on theme type
    return theme.type === 'dark' ? 'vs-dark' : 'vs';
  }, []);

  // Load tabs from cache
  const loadTabsFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(TABS_CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        // Check cache version for compatibility
        if (parsedCache.version === CACHE_VERSION && parsedCache.tabs && parsedCache.tabs.length > 0) {
          // Defer state updates to avoid infinite re-renders during useEffect
          setTimeout(() => {
            setTabs(parsedCache.tabs);
            setNextTabId(parsedCache.nextTabId || parsedCache.tabs.length + 1);
          }, 0);
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load tabs from cache:', error.message);
    }
    
    return false;
  }, []);

  // Save tabs to cache
  const saveTabsToCache = useCallback((tabsToSave, nextId) => {
    try {
      const cacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        tabs: tabsToSave,
        nextTabId: nextId
      };
      localStorage.setItem(TABS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save tabs to cache:', error.message);
    }
  }, []);

  // Initialize tabs on component mount
  useEffect(() => {
    if (!isInitialized) {
      const loaded = loadTabsFromCache();
      
      if (!loaded) {
        // Create default tab if no cache found - defer to avoid re-render loop
        setTimeout(() => {
          const defaultTabs = [
            { id: 1, name: 'Query 1', content: value || '-- Welcome to Flink SQL Editor\n-- Start writing your queries here\n', isActive: true }
          ];
          setTabs(defaultTabs);
          setNextTabId(2);
          setIsInitialized(true);
          saveTabsToCache(defaultTabs, 2);
        }, 0);
      } else {
        setIsInitialized(true);
      }
    }
  }, [value, loadTabsFromCache, saveTabsToCache, isInitialized]);

  // Save tabs to cache whenever tabs change (debounced)
  useEffect(() => {
    if (isInitialized && tabs.length > 0) {
      const timeoutId = setTimeout(() => {
        saveTabsToCache(tabs, nextTabId);
      }, 100); // Reduced debounce time to make it more responsive
      
      return () => clearTimeout(timeoutId);
    }
  }, [tabs, nextTabId, saveTabsToCache, isInitialized]);

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = (newTheme) => {
      setCurrentTheme(newTheme);
      // Update Monaco editor theme if editor is loaded
      if (editorRef.current && window.monaco) {
        const monacoTheme = getMonacoTheme(newTheme);
        window.monaco.editor.setTheme(monacoTheme);
      }
    };

    // Subscribe to theme changes
    themeService.addListener(handleThemeChange);
    
    // Set initial theme
    setCurrentTheme(themeService.getCurrentTheme());

    return () => {
      themeService.removeListener(handleThemeChange);
    };
  }, [getMonacoTheme]);

  // Get active tab
  const activeTab = tabs.find(tab => tab.isActive) || tabs[0];

  // Get the query to execute (selected text or full text)
  const getQueryToExecute = () => {
    if (!editorRef.current) return activeTab?.content || '';
    
    const selection = editorRef.current.getSelection();
    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    
    // If there's selected text, use it; otherwise use the full text
    return selectedText.trim() || activeTab?.content || '';
  };

  // Expose getQueryToExecute to parent component
  useImperativeHandle(ref, () => ({
    getQueryToExecute,
    insertSnippet: (snippetText) => {
      if (!editorRef.current) return;
      
      const editor = editorRef.current;
      const position = editor.getPosition();
      const selection = editor.getSelection();
      
      // Insert snippet at cursor position or replace selection
      const range = selection.isEmpty() 
        ? { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column }
        : selection;
      
      editor.executeEdits('insert-snippet', [{
        range: range,
        text: snippetText,
        forceMoveMarkers: true
      }]);
      
      // Focus the editor
      editor.focus();
      
      log.info('insertSnippet', 'Inserted snippet into editor');
    },
    // Expose cache management functions
    clearTabsCache: () => {
      localStorage.removeItem(TABS_CACHE_KEY);
      log.info('clearTabsCache', 'Cleared tabs cache');
    },
    exportTabs: () => {
      return {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        tabs: tabs,
        nextTabId: nextTabId
      };
    },
    importTabs: (importData) => {
      log.traceEnter('importTabs', { tabCount: importData.tabs?.length });
      
      try {
        if (importData.version === CACHE_VERSION && importData.tabs) {
          setTabs(importData.tabs);
          setNextTabId(importData.nextTabId || importData.tabs.length + 1);
          saveTabsToCache(importData.tabs, importData.nextTabId);
          log.info('importTabs', `Imported tabs: ${importData.tabs.length} tabs`);
          log.traceExit('importTabs', true);
          return true;
        }
      } catch (error) {
        log.error('importTabs', `Failed to import tabs: ${error.message}`);
      }
      
      log.traceExit('importTabs', false);
      return false;
    }
  }));

  // Update parent when active tab content changes
  useEffect(() => {
    if (activeTab && onChange) {
      onChange(activeTab.content);
    }
  }, [activeTab?.content]); // Removed onChange from dependencies to prevent infinite re-renders

  // Add new tab
  const addTab = () => {
    const newTab = {
      id: nextTabId,
      name: `Query ${nextTabId}`,
      content: '-- New query\n',
      isActive: false,
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    
    const newTabs = [
      ...tabs.map(tab => ({ ...tab, isActive: false })),
      { ...newTab, isActive: true }
    ];
    
    setTabs(newTabs);
    setNextTabId(prev => prev + 1);
    
    log.info('addNewTab', `Added new tab: ${newTab.name}`);
  };

  // Switch to tab
  const switchToTab = (tabId) => {
    const targetTab = tabs.find(t => t.id === tabId);
    log.traceEnter('switchToTab', { tabId, tabName: targetTab?.name });
    
    setTabs(prevTabs => 
      prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId,
        lastAccessed: tab.id === tabId ? Date.now() : tab.lastAccessed
      }))
    );
    
    log.info('switchToTab', `Switched to tab: ${targetTab?.name}`);
    log.traceExit('switchToTab');
  };

  // Close tab
  const closeTab = (tabId, e) => {
    e.stopPropagation();
    
    if (tabs.length === 1) return; // Don't close the last tab
    
    const tabToClose = tabs.find(t => t.id === tabId);
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const wasActive = tabs[tabIndex].isActive;
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    
    // If we closed the active tab, activate another one
    if (wasActive && newTabs.length > 0) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      newTabs[newActiveIndex].isActive = true;
      newTabs[newActiveIndex].lastAccessed = Date.now();
    }
    
    setTabs(newTabs);
    // Immediately save to cache to prevent restoration
    saveTabsToCache(newTabs, nextTabId);
    
    log.info('closeTab', `Closed tab: ${tabToClose?.name}`);
  };

  // Rename tab (double-click)
  const renameTab = (tabId, newName) => {
    if (!newName.trim()) return;
    
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { 
          ...tab, 
          name: newName.trim(),
          lastModified: Date.now()
        } : tab
      )
    );
    
    log.info('renameTab', `Renamed tab to: ${newName.trim()}`);
  };

  // Duplicate tab
  const duplicateTab = (tabId) => {
    const tabToDuplicate = tabs.find(t => t.id === tabId);
    if (!tabToDuplicate) return;
    
    const newTab = {
      id: nextTabId,
      name: `${tabToDuplicate.name} (Copy)`,
      content: tabToDuplicate.content,
      isActive: false,
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    
    const newTabs = [
      ...tabs.map(tab => ({ ...tab, isActive: false })),
      { ...newTab, isActive: true }
    ];
    
    setTabs(newTabs);
    setNextTabId(prev => prev + 1);
    
    log.info('duplicateTab', `Duplicated tab: ${tabToDuplicate.name}`);
  };

  // Effect to handle active tab changes and force layout
  useEffect(() => {
    if (editorRef.current && activeTab) {
      // Small delay to ensure DOM is updated when switching tabs
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 10);
    }
  }, [activeTab?.id]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Consolidated layout update function
    const updateLayout = () => {
      if (editor) {
        requestAnimationFrame(() => {
          editor.layout();
        });
      }
    };
    
    // Initial layout after mount
    setTimeout(updateLayout, 50);
    
    // Set up resize observer for container changes
    const resizeObserver = new ResizeObserver(updateLayout);
    const editorContainer = editor.getContainerDomNode();
    
    if (editorContainer) {
      // Observe the editor container and its immediate parent
      resizeObserver.observe(editorContainer);
      if (editorContainer.parentElement) {
        resizeObserver.observe(editorContainer.parentElement);
      }
    }
    
    // Handle window resize
    window.addEventListener('resize', updateLayout);
    
    // Handle mosaic layout changes with staggered updates for smooth transitions
    const handleMosaicResize = () => {
      updateLayout(); // Immediate update
      setTimeout(updateLayout, 50);  // Follow-up update
      setTimeout(updateLayout, 150); // Final update for slow transitions
    };
    
    window.addEventListener('mosaicLayoutChange', handleMosaicResize);
    window.addEventListener('panelStateChange', handleMosaicResize);
    
    // Clean up on unmount
    editor.onDidDispose(() => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('mosaicLayoutChange', handleMosaicResize);
      window.removeEventListener('panelStateChange', handleMosaicResize);
    });
    
    // Configure SQL language
    monaco.languages.setLanguageConfiguration('sql', {
      comments: {
        lineComment: '--',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ]
    });

    // Add Flink SQL keywords
    monaco.languages.setMonarchTokensProvider('sql', {
      tokenizer: {
        root: [
          // Flink SQL specific keywords
          [/\b(?:CREATE|DROP|ALTER|INSERT|SELECT|FROM|WHERE|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|UNION|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|IF|EXISTS|NOT|NULL|TRUE|FALSE|AND|OR|IN|BETWEEN|LIKE|IS|TABLE|VIEW|DATABASE|SCHEMA|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|UNIQUE|CHECK|DEFAULT|AUTO_INCREMENT|TIMESTAMP|DATE|TIME|DATETIME|VARCHAR|CHAR|TEXT|INT|INTEGER|BIGINT|SMALLINT|TINYINT|DECIMAL|FLOAT|DOUBLE|BOOLEAN|BLOB|CLOB|WITH|CONNECTOR|FORMAT|PATH|WATERMARK|FOR|SYSTEM_TIME|AS|OF|PROCTIME|ROWTIME)\b/i, 'keyword'],
          
          // Strings
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/'/, 'string', '@string'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@dstring'],
          
          // Numbers
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/\d+/, 'number'],
          
          // Comments
          [/--.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          
          // Operators
          [/[;,.]/, 'delimiter'],
          [/[(){}[\]]/, '@brackets'],
          [/[<>=!%&+\-*/|~^]/, 'operator'],
        ],
        
        string: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape.invalid'],
          [/'/, 'string', '@pop']
        ],
        
        dstring: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop']
        ],
        
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\/\*/, 'comment', '@push'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ]
      }
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!isExecuting) {
        handleExecute();
      }
    });

    // Add keyboard shortcut for new tab
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT, () => {
      addTab();
    });

    // Add keyboard shortcut for close tab
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      if (tabs.length > 1 && activeTab) {
        const fakeEvent = { stopPropagation: () => {} };
        closeTab(activeTab.id, fakeEvent);
      }
    });

    // Focus the editor
    editor.focus();
  };

  // Handle execution with selection support
  const handleExecute = () => {
    const queryToExecute = getQueryToExecute();
    const truncatedQuery = queryToExecute.length > 100 ? queryToExecute.substring(0, 100) + '...' : queryToExecute;
    log.info('handleExecute', `Executing query from tab "${activeTab?.name}": ${truncatedQuery}`);
    onExecute(queryToExecute);
  };

  // Handle content change
  const handleChange = useCallback((newValue) => {
    const content = newValue || '';
    
    // Update the active tab's content using functional update to avoid stale closure
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.isActive ? { 
          ...tab, 
          content,
          lastModified: Date.now()
        } : tab
      )
    );
  }, []); // No dependencies to prevent recreation on every render

  return (
    <div className="sql-editor-container">
      {/* Tab Bar */}
      <div className="sql-editor-tabs">
        <div className="tabs-container">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.isActive ? 'active' : ''}`}
              onClick={() => switchToTab(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                // Right-click context menu could be added here
                const action = confirm(`Duplicate tab "${tab.name}"?`);
                if (action) duplicateTab(tab.id);
              }}
            >
              <span 
                className="tab-name"
                onDoubleClick={(e) => {
                  const newName = prompt('Enter new tab name:', tab.name);
                  if (newName) renameTab(tab.id, newName);
                }}
                title={`${tab.name}\nDouble-click to rename\nRight-click to duplicate\nCreated: ${new Date(tab.createdAt || Date.now()).toLocaleString()}`}
              >
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => closeTab(tab.id, e)}
                  title="Close tab (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            className="add-tab-button"
            onClick={addTab}
            title="Add new tab (Ctrl+T)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="monaco-editor-container">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={activeTab?.content || ''}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme={getMonacoTheme(currentTheme)}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            contextmenu: true,
            selectOnLineNumbers: true,
            glyphMargin: false,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'always',
            matchBrackets: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            snippetSuggestions: 'top',
            quickSuggestions: true,
            parameterHints: {
              enabled: true
            },
            // Optimized scrollbar settings
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            }
          }}
        />
        
        {/* Selection indicator */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#ccc',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none',
          maxWidth: '300px',
          textAlign: 'center'
        }}>
          💡 Ctrl+T: New Tab • Ctrl+W: Close Tab • Ctrl+Enter: Execute
        </div>
      </div>
    </div>
  );
});

export default SqlEditor;
