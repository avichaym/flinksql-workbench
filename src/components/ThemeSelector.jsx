import React, { useState, useEffect } from 'react';
import { Palette, Download, Upload, Trash2, Eye, Settings, Save, X } from 'lucide-react';
import themeService from '../services/themeService.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ThemeSelector');

const ThemeSelector = ({ isOpen, onClose }) => {
  const [currentTheme, setCurrentTheme] = useState(themeService.getCurrentTheme());
  const [themes, setThemes] = useState(themeService.getAllThemes());
  const [categories, setCategories] = useState(themeService.getThemeCategories());
  const [selectedCategory, setSelectedCategory] = useState('dark');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [previewTheme, setPreviewTheme] = useState(null);

  // Update state when themes change
  useEffect(() => {
    const handleThemeChange = (themeId) => {
      setCurrentTheme(themeId);
      setThemes(themeService.getAllThemes());
      setCategories(themeService.getThemeCategories());
    };

    themeService.addListener(handleThemeChange);
    return () => themeService.removeListener(handleThemeChange);
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && event.target.closest('.theme-selector-modal') === null) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleThemeSelect = (themeId) => {
    themeService.setTheme(themeId);
    setPreviewTheme(null);
  };

  const handlePreviewTheme = (themeId) => {
    if (previewTheme === themeId) {
      setPreviewTheme(null);
      themeService.setTheme(currentTheme);
    } else {
      setPreviewTheme(themeId);
      themeService.setTheme(themeId);
    }
  };

  const handleExportTheme = (themeId) => {
    try {
      const themeJson = themeService.exportTheme(themeId);
      const blob = new Blob([themeJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flink-theme-${themeId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      log.error('handleExportTheme', 'Failed to export theme', { themeId, error });
    }
  };

  const handleDeleteCustomTheme = (themeId) => {
    if (window.confirm('Are you sure you want to delete this custom theme?')) {
      try {
        themeService.deleteCustomTheme(themeId);
      } catch (error) {
        log.error('handleDeleteCustomTheme', 'Failed to delete theme', { themeId, error });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="theme-selector-overlay">
      <div className="theme-selector-modal">
        {/* Header */}
        <div className="theme-selector-header">
          <div className="theme-selector-title">
            <Palette className="w-5 h-5" />
            <span>Theme Selector</span>
          </div>
          <div className="theme-selector-actions">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-icon-only btn-secondary"
              title="Import theme"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-icon-only btn-secondary"
              title="Create custom theme"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="btn-icon-only btn-secondary"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="theme-selector-content">
          {/* Category tabs */}
          <div className="theme-categories">
            {Object.entries(categories).map(([categoryKey, categoryThemes]) => (
              <button
                key={categoryKey}
                onClick={() => setSelectedCategory(categoryKey)}
                className={`theme-category-tab ${selectedCategory === categoryKey ? 'active' : ''}`}
              >
                {categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} ({categoryThemes.length})
              </button>
            ))}
          </div>

          {/* Theme grid */}
          <div className="theme-grid">
            {categories[selectedCategory]?.map((theme) => (
              <div
                key={theme.id}
                className={`theme-card ${currentTheme === theme.id ? 'current' : ''} ${previewTheme === theme.id ? 'preview' : ''}`}
              >
                {/* Theme preview */}
                <div className="theme-preview" style={{
                  background: theme.colors['bg-primary'],
                  border: `1px solid ${theme.colors['border']}`
                }}>
                  <div className="theme-preview-header" style={{
                    background: theme.colors['bg-secondary'],
                    borderBottom: `1px solid ${theme.colors['border']}`
                  }}>
                    <div className="theme-preview-dots">
                      <span style={{ background: theme.colors['red'] }}></span>
                      <span style={{ background: theme.colors['yellow'] }}></span>
                      <span style={{ background: theme.colors['green'] }}></span>
                    </div>
                  </div>
                  <div className="theme-preview-content">
                    <div className="theme-preview-sidebar" style={{
                      background: theme.colors['bg-tertiary'],
                      borderRight: `1px solid ${theme.colors['border']}`
                    }}>
                      <div style={{
                        background: theme.colors['blue'],
                        height: '3px',
                        margin: '4px 2px'
                      }}></div>
                      <div style={{
                        background: theme.colors['text-secondary'],
                        height: '2px',
                        margin: '2px 2px'
                      }}></div>
                      <div style={{
                        background: theme.colors['text-tertiary'],
                        height: '2px',
                        margin: '2px 2px'
                      }}></div>
                    </div>
                    <div className="theme-preview-main">
                      <div style={{
                        background: theme.colors['text-primary'],
                        height: '2px',
                        margin: '2px'
                      }}></div>
                      <div style={{
                        background: theme.colors['green'],
                        height: '2px',
                        margin: '2px',
                        width: '60%'
                      }}></div>
                      <div style={{
                        background: theme.colors['text-secondary'],
                        height: '2px',
                        margin: '2px',
                        width: '80%'
                      }}></div>
                    </div>
                  </div>
                </div>

                {/* Theme info */}
                <div className="theme-info">
                  <div className="theme-name">{theme.name}</div>
                  <div className="theme-type">{theme.type}</div>
                </div>

                {/* Theme actions */}
                <div className="theme-actions">
                  <button
                    onClick={() => handlePreviewTheme(theme.id)}
                    className={`btn-icon-only btn-secondary ${previewTheme === theme.id ? 'active' : ''}`}
                    title="Preview theme"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleThemeSelect(theme.id)}
                    className={`btn-icon-only ${currentTheme === theme.id ? 'btn-primary' : 'btn-secondary'}`}
                    title="Apply theme"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleExportTheme(theme.id)}
                    className="btn-icon-only btn-secondary"
                    title="Export theme"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {theme.custom && (
                    <button
                      onClick={() => handleDeleteCustomTheme(theme.id)}
                      className="btn-icon-only btn-danger"
                      title="Delete custom theme"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current theme info */}
        <div className="theme-selector-footer">
          <div className="current-theme-info">
            <span>Current: {themes[currentTheme]?.name || 'Unknown'}</span>
            {previewTheme && (
              <span className="preview-indicator">
                (Previewing: {themes[previewTheme]?.name})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateThemeModal
          onClose={() => setShowCreateModal(false)}
          onCreateTheme={(name, baseTheme, colors) => {
            themeService.createCustomTheme(name, baseTheme, colors);
            setShowCreateModal(false);
          }}
        />
      )}

      {showImportModal && (
        <ImportThemeModal
          onClose={() => setShowImportModal(false)}
          onImportTheme={(themeJson) => {
            try {
              const count = themeService.importTheme(themeJson);
              alert(`Successfully imported ${count} theme(s)`);
              setShowImportModal(false);
            } catch (error) {
              alert(`Failed to import theme: ${error.message}`);
            }
          }}
        />
      )}
    </div>
  );
};

// Create Theme Modal Component
const CreateThemeModal = ({ onClose, onCreateTheme }) => {
  const [name, setName] = useState('');
  const [baseTheme, setBaseTheme] = useState('vscode-dark');
  const [colors, setColors] = useState({});
  const themes = themeService.getAllThemes();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateTheme(name.trim(), baseTheme, colors);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content create-theme-modal">
        <div className="modal-header">
          <h3>Create Custom Theme</h3>
          <button onClick={onClose} className="btn-icon-only btn-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Theme Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Theme"
              required
            />
          </div>
          <div className="form-group">
            <label>Base Theme</label>
            <select value={baseTheme} onChange={(e) => setBaseTheme(e.target.value)}>
              {Object.entries(themes).map(([id, theme]) => (
                <option key={id} value={id}>{theme.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Theme</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Import Theme Modal Component
const ImportThemeModal = ({ onClose, onImportTheme }) => {
  const [themeJson, setThemeJson] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (themeJson.trim()) {
      onImportTheme(themeJson.trim());
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setThemeJson(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content import-theme-modal">
        <div className="modal-header">
          <h3>Import Theme</h3>
          <button onClick={onClose} className="btn-icon-only btn-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Upload Theme File</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="file-input"
            />
          </div>
          <div className="form-group">
            <label>Or Paste Theme JSON</label>
            <textarea
              value={themeJson}
              onChange={(e) => setThemeJson(e.target.value)}
              placeholder="Paste theme JSON here..."
              rows={10}
              required
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Import Theme</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ThemeSelector;
