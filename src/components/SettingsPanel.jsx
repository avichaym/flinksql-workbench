import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Palette } from 'lucide-react';
import { settingsService } from '../services/index.js';
import themeService from '../services/themeService.js';
import ThemeSelector from './ThemeSelector.jsx';
import logger from '../utils/logger.js';

const log = logger.getModuleLogger('SettingsPanel');

const SettingsPanel = ({ onTestConnection, isVisible, onClose }) => {
  const [settings, setSettings] = useState(settingsService.getSettings());
  const [showPassword, setShowPassword] = useState(false);
  const [sessionPropertiesText, setSessionPropertiesText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(themeService.getCurrentTheme());

  useEffect(() => {
    // Load current settings and fix any legacy data
    log.info('useEffect', 'SettingsPanel loading...');
    const currentSettings = settingsService.getSettings();
    
    // Force fix if gateway URL is still showing localhost (should use environment)
    if (currentSettings.gateway.url === 'http://localhost:8083') {
      log.info('useEffect', 'Fixing default localhost URL, resetting to use environment...');
      settingsService.resetToDefaults();
      const fixedSettings = settingsService.getSettings();
      setSettings(fixedSettings);
      setSessionPropertiesText(JSON.stringify(fixedSettings.session.properties, null, 2));
    } else if (currentSettings.gateway.url === '/api/flink') {
      log.info('useEffect', 'Fixing legacy gateway URL setting...');
      settingsService.resetToDefaults();
      const fixedSettings = settingsService.getSettings();
      setSettings(fixedSettings);
      setSessionPropertiesText(JSON.stringify(fixedSettings.session.properties, null, 2));
    } else {
      setSettings(currentSettings);
      setSessionPropertiesText(JSON.stringify(currentSettings.session.properties, null, 2));
    }

    // Listen for settings changes
    const handleSettingsChange = (newSettings) => {
      setSettings(newSettings);
      setSessionPropertiesText(JSON.stringify(newSettings.session.properties, null, 2));
      setIsDirty(false);
    };

    settingsService.addListener(handleSettingsChange);

    // Listen for theme changes
    const handleThemeChange = (themeId) => {
      setCurrentTheme(themeId);
    };

    themeService.addListener(handleThemeChange);

    return () => {
      settingsService.removeListener(handleSettingsChange);
      themeService.removeListener(handleThemeChange);
    };
  }, []);

  const handleInputChange = (path, value) => {
    const newSettings = { ...settings };
    const keys = path.split('.');
    let target = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
    
    setSettings(newSettings);
    setIsDirty(true);
  };

  const handleSessionPropertiesChange = (value) => {
    setSessionPropertiesText(value);
    setIsDirty(true);
  };

  const handleConnect = async () => {
    // Save settings first
    try {
      const sessionProperties = JSON.parse(sessionPropertiesText);
      
      settingsService.updateSettings({
        'gateway.url': settings.gateway.url, // Save the actual URL
        'gateway.username': settings.gateway.username,
        'gateway.password': settings.gateway.password,
        'gateway.apiToken': settings.gateway.apiToken,
        'session.properties': sessionProperties,
        'ui.autoSave': settings.ui.autoSave
      });

      setIsDirty(false);
      
      // Test connection
      if (onTestConnection) {
        await onTestConnection();
      }
    } catch (error) {
      log.error('handleSave', `Invalid session properties JSON: ${error.message}`);
      alert('Invalid JSON in session properties. Please check the format.');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-panel-table">
        <div className="settings-header">
          <h2>Flink Gateway Settings</h2>
          <button onClick={onClose} className="close-button" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="settings-content">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="setting-label">Gateway URL</td>
                <td className="setting-value">
                  <input
                    type="text"
                    value={settings.gateway.url}
                    onChange={(e) => handleInputChange('gateway.url', e.target.value)}
                    placeholder="http://localhost:8083 or https://your-flink-gateway.com"
                    className="setting-input"
                  />
                  <div className="setting-help">
                    Enter the actual Flink SQL Gateway URL. The app will use proxy to avoid CORS issues.
                  </div>
                </td>
              </tr>
              
              <tr>
                <td className="setting-label">Username</td>
                <td className="setting-value">
                  <input
                    type="text"
                    value={settings.gateway.username}
                    onChange={(e) => handleInputChange('gateway.username', e.target.value)}
                    placeholder="Username for authentication"
                    className="setting-input"
                  />
                </td>
              </tr>
              
              <tr>
                <td className="setting-label">Password</td>
                <td className="setting-value">
                  <div className="password-input-container">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={settings.gateway.password}
                      onChange={(e) => handleInputChange('gateway.password', e.target.value)}
                      placeholder="Password for authentication"
                      className="setting-input password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle-btn"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
              
              <tr>
                <td className="setting-label">API Token</td>
                <td className="setting-value">
                  <div className="password-input-container">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={settings.gateway.apiToken}
                      onChange={(e) => handleInputChange('gateway.apiToken', e.target.value)}
                      placeholder="Bearer token (alternative to username/password)"
                      className="setting-input password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle-btn"
                      title={showPassword ? 'Hide token' : 'Show token'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
              
              <tr>
                <td className="setting-label">Auto Save</td>
                <td className="setting-value">
                  <input
                    type="checkbox"
                    checked={settings.ui.autoSave}
                    onChange={(e) => handleInputChange('ui.autoSave', e.target.checked)}
                    className="setting-checkbox"
                  />
                </td>
              </tr>

              <tr>
                <td className="setting-label">Log Level</td>
                <td className="setting-value">
                  <select
                    value={settings.logging?.level || 'info'}
                    onChange={(e) => handleInputChange('logging.level', e.target.value)}
                    className="setting-select"
                  >
                    <option value="trace">TRACE</option>
                    <option value="debug">DEBUG</option>
                    <option value="info">INFO</option>
                    <option value="warn">WARN</option>
                    <option value="error">ERROR</option>
                  </select>
                  <div className="setting-help">
                    Minimum log level for application logging
                  </div>
                </td>
              </tr>

              <tr>
                <td className="setting-label">Console Log Level</td>
                <td className="setting-value">
                  <select
                    value={settings.logging?.consoleLevel || 'warn'}
                    onChange={(e) => handleInputChange('logging.consoleLevel', e.target.value)}
                    className="setting-select"
                  >
                    <option value="trace">TRACE</option>
                    <option value="debug">DEBUG</option>
                    <option value="info">INFO</option>
                    <option value="warn">WARN</option>
                    <option value="error">ERROR</option>
                  </select>
                  <div className="setting-help">
                    Minimum log level for browser console output
                  </div>
                </td>
              </tr>

              <tr>
                <td className="setting-label">Debug Panel Log Level</td>
                <td className="setting-value">
                  <select
                    value={settings.logging?.panelLevel || 'info'}
                    onChange={(e) => handleInputChange('logging.panelLevel', e.target.value)}
                    className="setting-select"
                  >
                    <option value="trace">TRACE</option>
                    <option value="debug">DEBUG</option>
                    <option value="info">INFO</option>
                    <option value="warn">WARN</option>
                    <option value="error">ERROR</option>
                  </select>
                  <div className="setting-help">
                    Minimum log level for debug panel display
                  </div>
                </td>
              </tr>

              <tr>
                <td className="setting-label">Show TRACE in Debug Panel</td>
                <td className="setting-value">
                  <input
                    type="checkbox"
                    checked={settings.logging?.enableTraceInPanel || false}
                    onChange={(e) => handleInputChange('logging.enableTraceInPanel', e.target.checked)}
                    className="setting-checkbox"
                  />
                  <div className="setting-help">
                    Enable TRACE level logs to appear in debug panel (can be verbose)
                  </div>
                </td>
              </tr>
              
              <tr>
                <td className="setting-label">Session Properties</td>
                <td className="setting-value">
                  <textarea
                    value={sessionPropertiesText}
                    onChange={(e) => handleSessionPropertiesChange(e.target.value)}
                    placeholder={`{
  "execution.runtime-mode": "streaming",
  "table.exec.resource.default-parallelism": "1"
}`}
                    className="setting-textarea"
                    rows="6"
                  />
                </td>
              </tr>

              <tr>
                <td className="setting-label">Theme</td>
                <td className="setting-value">
                  <div className="theme-setting-container">
                    <div className="current-theme-display">
                      <span className="current-theme-name">
                        {themeService.getTheme(currentTheme).name}
                      </span>
                      <span className="current-theme-type">
                        ({themeService.getTheme(currentTheme).type})
                      </span>
                    </div>
                    <button
                      onClick={() => setShowThemeSelector(true)}
                      className="btn-secondary theme-selector-btn"
                    >
                      <Palette className="w-4 h-4" />
                      Change Theme
                    </button>
                  </div>
                  <div className="setting-help">
                    Choose from built-in themes or create custom color schemes.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="settings-footer">
          <div className="footer-actions">
            <button onClick={handleConnect} className="btn-primary">
              Connect
            </button>
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
      
      {/* Theme Selector Modal */}
      <ThemeSelector
        isOpen={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
      />
    </div>
  );
};

export default SettingsPanel;
