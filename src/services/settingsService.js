import logger from '../utils/logger.js';

const log = logger.getModuleLogger('SettingsService');

class SettingsService {
  constructor() {
    this.settings = this.loadSettings();
    this.listeners = new Set();
  }

  // Load settings from localStorage or use environment-based defaults
  loadSettings() {
    const savedSettings = localStorage.getItem('flink-workbench-settings');
    
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        log.info('loadSettings', `Loaded settings from localStorage`, parsed);
        
        // If the gateway URL is the old proxy format, reset it
        if (parsed.gateway?.url === '/api/flink') {
          log.info('loadSettings', 'Detected old proxy URL format, resetting to actual URL...');
          delete parsed.gateway.url; // This will force it to use environment/default values
        }
        
        return this.validateSettings(parsed);
      } catch (error) {
        log.warn('loadSettings', `Failed to parse saved settings, using defaults: ${error.message}`);
      }
    }

    // Read environment variables - prioritize OS environment variables (FLINK_*) over Vite ones (VITE_FLINK_*)
    const envGatewayUrl = import.meta.env.FLINK_HOST || import.meta.env.VITE_FLINK_HOST;
    const envUsername = import.meta.env.FLINK_USERNAME || import.meta.env.VITE_FLINK_USERNAME;
    const envPassword = import.meta.env.FLINK_PASSWORD || import.meta.env.VITE_FLINK_PASSWORD;
    const envApiToken = import.meta.env.FLINK_API_TOKEN || import.meta.env.VITE_FLINK_API_TOKEN;

    log.debug('loadFromEnvironment', 'Environment variables detected', {
      gatewayUrl: envGatewayUrl || 'not set',
      username: envUsername ? '***' : 'not set',
      password: envPassword ? '***' : 'not set',
      apiToken: envApiToken ? '***' : 'not set'
    });

    log.trace('loadFromEnvironment', 'Raw environment check', {
      'import.meta.env.VITE_FLINK_HOST': import.meta.env.VITE_FLINK_HOST,
      'import.meta.env.FLINK_HOST': import.meta.env.FLINK_HOST
    });

    // Default settings based on environment variables or fallbacks
    const defaults = {
      gateway: {
        // Use proxy by default for development, or environment URL if specified
        url: envGatewayUrl || '/api/flink',
        username: envUsername || '',
        password: envPassword || '',
        apiToken: envApiToken || ''
      },
      session: {
        properties: {
          'execution.runtime-mode': 'streaming',
          'table.exec.resource.default-parallelism': '1',
          'execution.checkpointing.interval': '10s'
        }
      },
      ui: {
        theme: 'dark',
        autoSave: true
      },
      logging: {
        level: 'info',
        consoleLevel: 'warn',
        panelLevel: 'info',
        enableTraceInPanel: false,
        modules: {}
      }
    };

    log.debug('loadFromEnvironment', 'Using settings with environment variables', {
      ...defaults,
      gateway: {
        ...defaults.gateway,
        password: defaults.gateway.password ? '***' : '',
        apiToken: defaults.gateway.apiToken ? '***' : ''
      }
    });
    return defaults;
  }

  // Validate settings structure and provide defaults for missing fields
  validateSettings(settings) {
    const validated = {
      gateway: {
        // Keep the URL as-is, defaulting to proxy if not set
        url: settings.gateway?.url || '/api/flink',
        username: settings.gateway?.username || '',
        password: settings.gateway?.password || '',
        apiToken: settings.gateway?.apiToken || ''
      },
      session: {
        properties: settings.session?.properties || {
          'execution.runtime-mode': 'streaming',
          'table.exec.resource.default-parallelism': '1',
          'execution.checkpointing.interval': '10s'
        }
      },
      ui: {
        autoSave: settings.ui?.autoSave !== false // Default to true
      },
      logging: {
        level: settings.logging?.level || 'info',
        consoleLevel: settings.logging?.consoleLevel || 'warn',
        panelLevel: settings.logging?.panelLevel || 'info',
        enableTraceInPanel: settings.logging?.enableTraceInPanel || false,
        modules: settings.logging?.modules || {}
      }
    };

    return validated;
  }

  // Save settings to localStorage
  saveSettings() {
    try {
      localStorage.setItem('flink-workbench-settings', JSON.stringify(this.settings));
      log.debug('saveSettings', 'Settings saved to localStorage');
      this.notifyListeners();
    } catch (error) {
      log.error('saveSettings', 'Failed to save settings', { error: error.message, stack: error.stack });
    }
  }

  // Get all settings
  getSettings() {
    return { ...this.settings };
  }

  // Get specific setting by path (e.g., 'gateway.url' or 'session.properties')
  getSetting(path) {
    const keys = path.split('.');
    let value = this.settings;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Update specific setting by path
  updateSetting(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.settings;
    
    // Navigate to the parent object
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    // Set the value
    target[lastKey] = value;
    
    log.debug('updateSetting', `Updated setting ${path}`, { path, value });
    this.saveSettings();
  }

  // Update multiple settings at once
  updateSettings(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.updateSetting(path, value);
    }
  }

  // Reset to default settings
  resetToDefaults() {
    log.info('resetToDefaults', 'Resetting settings to defaults...');
    localStorage.removeItem('flink-workbench-settings');
    this.settings = this.loadSettings();
    this.notifyListeners();
  }

  // Gateway-specific helpers
  getGatewayUrl() {
    return this.getSetting('gateway.url');
  }

  getGatewayCredentials() {
    return {
      username: this.getSetting('gateway.username'),
      password: this.getSetting('gateway.password')
    };
  }

  setGatewayUrl(url) {
    this.updateSetting('gateway.url', url);
  }

  setGatewayCredentials(username, password) {
    this.updateSettings({
      'gateway.username': username,
      'gateway.password': password
    });
  }

  // Session properties helpers
  getSessionProperties() {
    return { ...this.getSetting('session.properties') };
  }

  setSessionProperties(properties) {
    this.updateSetting('session.properties', properties);
  }

  addSessionProperty(key, value) {
    const current = this.getSessionProperties();
    current[key] = value;
    this.setSessionProperties(current);
  }

  removeSessionProperty(key) {
    const current = this.getSessionProperties();
    delete current[key];
    this.setSessionProperties(current);
  }

  // UI settings helpers
  getTheme() {
    return this.getSetting('ui.theme');
  }

  setTheme(theme) {
    this.updateSetting('ui.theme', theme);
    // Also update the theme service if available
    if (typeof window !== 'undefined' && window.themeService) {
      window.themeService.setTheme(theme);
    }
  }

  isAutoSaveEnabled() {
    return this.getSetting('ui.autoSave');
  }

  setAutoSave(enabled) {
    this.updateSetting('ui.autoSave', enabled);
  }

  // Event listeners for settings changes
  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.settings);
      } catch (error) {
        log.error('notifyListeners', `Error in settings listener: ${error.message}`, { 
          error: error.stack 
        });
      }
    });
  }

  // Reset settings to defaults
  resetSettings() {
    localStorage.removeItem('flink-workbench-settings');
    this.settings = this.loadSettings();
    this.saveSettings();
    log.info('resetSettings', 'Settings reset to defaults');
  }

  // Export settings for backup
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  // Import settings from backup
  importSettings(settingsJson) {
    try {
      const imported = JSON.parse(settingsJson);
      this.settings = this.validateSettings(imported);
      this.saveSettings();
      log.info('importSettings', 'Settings imported successfully');
      return true;
    } catch (error) {
      log.error('importSettings', `Failed to import settings: ${error.message}`, { error: error.stack });
      return false;
    }
  }

  // Check if environment variables are available
  getEnvironmentStatus() {
    const envVars = {
      FLINK_HOST: import.meta.env.FLINK_HOST || import.meta.env.VITE_FLINK_HOST,
      FLINK_USERNAME: import.meta.env.FLINK_USERNAME || import.meta.env.VITE_FLINK_USERNAME,
      FLINK_PASSWORD: import.meta.env.FLINK_PASSWORD || import.meta.env.VITE_FLINK_PASSWORD,
      FLINK_API_TOKEN: import.meta.env.FLINK_API_TOKEN || import.meta.env.VITE_FLINK_API_TOKEN
    };

    const status = {
      hasEnvVars: Object.values(envVars).some(val => val !== undefined),
      envVars: Object.fromEntries(
        Object.entries(envVars).map(([key, value]) => [
          key, 
          value ? (key.includes('PASSWORD') || key.includes('TOKEN') ? '***' : value) : 'not set'
        ])
      )
    };

    log.debug('getEnvironmentStatus', 'Environment variable status', { status });
    return status;
  }
}

// Create and export singleton instance
const settingsService = new SettingsService();
export default settingsService;
