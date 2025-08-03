import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ThemeService');

/**
 * ThemeService - Manages color schemes and themes across the application
 * Supports multiple predefined themes and custom theme creation
 */

const THEMES = {
  'vscode-dark': {
    name: 'VS Code Dark',
    type: 'dark',
    colors: {
      // Background colors
      'bg-primary': '#1e1e1e',
      'bg-secondary': '#252526',
      'bg-tertiary': '#2d2d30',
      'bg-quaternary': '#383838',
      
      // Text colors
      'text-primary': '#cccccc',
      'text-secondary': '#969696',
      'text-tertiary': '#6c6c6c',
      'text-disabled': '#4a4a4a',
      
      // Border and outline colors
      'border': '#464647',
      'border-light': '#5a5a5a',
      'border-focus': '#007acc',
      
      // Status colors
      'blue': '#007acc',
      'green': '#4ec9b0',
      'red': '#f44747',
      'orange': '#d19a66',
      'yellow': '#ffcc02',
      'purple': '#c586c0',
      'cyan': '#4fc1ff',
      
      // Interactive states
      'hover': '#2a2d2e',
      'active': '#094771',
      'selection': '#264f78',
      
      // Input and form colors
      'input-bg': '#3c3c3c',
      'input-border': '#464647',
      'input-focus': '#007acc',
      
      // Button colors
      'button-primary-bg': '#0e639c',
      'button-primary-hover': '#1177bb',
      'button-secondary-bg': '#2d2d30',
      'button-secondary-hover': '#404040',
    }
  },
  
  'vscode-light': {
    name: 'VS Code Light',
    type: 'light',
    colors: {
      // Background colors
      'bg-primary': '#ffffff',
      'bg-secondary': '#f8f8f8',
      'bg-tertiary': '#f0f0f0',
      'bg-quaternary': '#e8e8e8',
      
      // Text colors
      'text-primary': '#333333',
      'text-secondary': '#666666',
      'text-tertiary': '#999999',
      'text-disabled': '#cccccc',
      
      // Border and outline colors
      'border': '#d1d1d1',
      'border-light': '#e5e5e5',
      'border-focus': '#005fb8',
      
      // Status colors
      'blue': '#005fb8',
      'green': '#00875a',
      'red': '#d13438',
      'orange': '#bf8803',
      'yellow': '#f4b942',
      'purple': '#8e44ad',
      'cyan': '#17a2b8',
      
      // Interactive states
      'hover': '#f0f0f0',
      'active': '#e0e0e0',
      'selection': '#add6ff',
      
      // Input and form colors
      'input-bg': '#ffffff',
      'input-border': '#d1d1d1',
      'input-focus': '#005fb8',
      
      // Button colors
      'button-primary-bg': '#005fb8',
      'button-primary-hover': '#004494',
      'button-secondary-bg': '#f0f0f0',
      'button-secondary-hover': '#e0e0e0',
    }
  },
  
  'high-contrast-dark': {
    name: 'High Contrast Dark',
    type: 'dark',
    colors: {
      // Background colors
      'bg-primary': '#000000',
      'bg-secondary': '#0c0c0c',
      'bg-tertiary': '#181818',
      'bg-quaternary': '#242424',
      
      // Text colors
      'text-primary': '#ffffff',
      'text-secondary': '#ffffff',
      'text-tertiary': '#ffffff',
      'text-disabled': '#808080',
      
      // Border and outline colors
      'border': '#6fc3df',
      'border-light': '#6fc3df',
      'border-focus': '#f38518',
      
      // Status colors
      'blue': '#36c5f0',
      'green': '#89d185',
      'red': '#f48771',
      'orange': '#f38518',
      'yellow': '#ffcc02',
      'purple': '#b180d7',
      'cyan': '#89d185',
      
      // Interactive states
      'hover': '#1a1a1a',
      'active': '#f38518',
      'selection': '#f38518',
      
      // Input and form colors
      'input-bg': '#000000',
      'input-border': '#6fc3df',
      'input-focus': '#f38518',
      
      // Button colors
      'button-primary-bg': '#f38518',
      'button-primary-hover': '#ff9a3a',
      'button-secondary-bg': '#181818',
      'button-secondary-hover': '#242424',
    }
  },
  
  'ocean-dark': {
    name: 'Ocean Dark',
    type: 'dark',
    colors: {
      // Background colors
      'bg-primary': '#0d1117',
      'bg-secondary': '#161b22',
      'bg-tertiary': '#21262d',
      'bg-quaternary': '#30363d',
      
      // Text colors
      'text-primary': '#f0f6fc',
      'text-secondary': '#7d8590',
      'text-tertiary': '#656d76',
      'text-disabled': '#484f58',
      
      // Border and outline colors
      'border': '#30363d',
      'border-light': '#21262d',
      'border-focus': '#58a6ff',
      
      // Status colors
      'blue': '#58a6ff',
      'green': '#3fb950',
      'red': '#f85149',
      'orange': '#d29922',
      'yellow': '#f2cc60',
      'purple': '#bc8cff',
      'cyan': '#39c5cf',
      
      // Interactive states
      'hover': '#21262d',
      'active': '#1c2128',
      'selection': '#264f78',
      
      // Input and form colors
      'input-bg': '#0d1117',
      'input-border': '#30363d',
      'input-focus': '#58a6ff',
      
      // Button colors
      'button-primary-bg': '#238636',
      'button-primary-hover': '#2ea043',
      'button-secondary-bg': '#21262d',
      'button-secondary-hover': '#30363d',
    }
  },
  
  'sunset-light': {
    name: 'Sunset Light',
    type: 'light',
    colors: {
      // Background colors
      'bg-primary': '#fdf6e3',
      'bg-secondary': '#f7f0d7',
      'bg-tertiary': '#f0e9cb',
      'bg-quaternary': '#e9e2bf',
      
      // Text colors
      'text-primary': '#657b83',
      'text-secondary': '#839496',
      'text-tertiary': '#93a1a1',
      'text-disabled': '#bdbdbd',
      
      // Border and outline colors
      'border': '#d6cbb3',
      'border-light': '#e2d7ba',
      'border-focus': '#b58900',
      
      // Status colors
      'blue': '#268bd2',
      'green': '#859900',
      'red': '#dc322f',
      'orange': '#cb4b16',
      'yellow': '#b58900',
      'purple': '#6c71c4',
      'cyan': '#2aa198',
      
      // Interactive states
      'hover': '#f0e9cb',
      'active': '#e9e2bf',
      'selection': '#c5d4dd',
      
      // Input and form colors
      'input-bg': '#fdf6e3',
      'input-border': '#d6cbb3',
      'input-focus': '#b58900',
      
      // Button colors
      'button-primary-bg': '#859900',
      'button-primary-hover': '#9fb300',
      'button-secondary-bg': '#f0e9cb',
      'button-secondary-hover': '#e9e2bf',
    }
  }
};

class ThemeService {
  constructor() {
    this.currentTheme = 'vscode-dark';
    this.listeners = new Set();
    this.customThemes = this.loadCustomThemes();
  }

  // Load custom themes from localStorage
  loadCustomThemes() {
    try {
      const saved = localStorage.getItem('flink-workbench-custom-themes');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      log.warn('loadCustomThemes', 'Failed to load custom themes', { error });
      return {};
    }
  }

  // Save custom themes to localStorage
  saveCustomThemes() {
    try {
      localStorage.setItem('flink-workbench-custom-themes', JSON.stringify(this.customThemes));
    } catch (error) {
      log.error('saveCustomThemes', 'Failed to save custom themes', { error });
    }
  }

  // Get all available themes (built-in + custom)
  getAllThemes() {
    return {
      ...THEMES,
      ...this.customThemes
    };
  }

  // Get theme categories
  getThemeCategories() {
    const themes = this.getAllThemes();
    const categories = {
      dark: [],
      light: [],
      custom: []
    };

    Object.entries(themes).forEach(([id, theme]) => {
      if (this.customThemes[id]) {
        categories.custom.push({ id, ...theme });
      } else if (theme.type === 'dark') {
        categories.dark.push({ id, ...theme });
      } else {
        categories.light.push({ id, ...theme });
      }
    });

    return categories;
  }

  // Get current theme
  getCurrentTheme() {
    return this.currentTheme;
  }

  // Get theme data by ID
  getTheme(themeId) {
    const themes = this.getAllThemes();
    return themes[themeId] || themes['vscode-dark'];
  }

  // Set current theme
  setTheme(themeId) {
    const themes = this.getAllThemes();
    if (!themes[themeId]) {
      log.warn('setTheme', `Theme '${themeId}' not found, falling back to 'vscode-dark'`, { requestedTheme: themeId });
      themeId = 'vscode-dark';
    }

    this.currentTheme = themeId;
    this.applyTheme(themeId);
    this.notifyListeners(themeId);
    
    // Save to localStorage
    localStorage.setItem('flink-workbench-current-theme', themeId);
    
    log.info('setTheme', `Theme changed to: ${themes[themeId].name}`, { 
      themeId, 
      themeName: themes[themeId].name 
    });
  }

  // Apply theme to CSS custom properties
  applyTheme(themeId) {
    const theme = this.getTheme(themeId);
    const root = document.documentElement;

    // Apply all color variables
    Object.entries(theme.colors).forEach(([colorName, colorValue]) => {
      root.style.setProperty(`--theme-${colorName}`, colorValue);
      // Also set legacy vscode variables for backward compatibility
      if (colorName.startsWith('bg-') || colorName.startsWith('text-') || colorName === 'border') {
        const legacyName = colorName.replace('-', '-');
        root.style.setProperty(`--vscode-${legacyName}`, colorValue);
      }
    });

    // Set theme type data attribute for conditional styling
    root.setAttribute('data-theme', themeId);
    root.setAttribute('data-theme-type', theme.type);
  }

  // Load theme from localStorage on init
  loadSavedTheme() {
    const savedTheme = localStorage.getItem('flink-workbench-current-theme');
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('vscode-dark');
    }
  }

  // Create a custom theme
  createCustomTheme(name, baseThemeId, colorOverrides = {}) {
    const baseTheme = this.getTheme(baseThemeId);
    const customId = `custom-${Date.now()}`;
    
    const customTheme = {
      name: name,
      type: baseTheme.type,
      custom: true,
      baseTheme: baseThemeId,
      colors: {
        ...baseTheme.colors,
        ...colorOverrides
      }
    };

    this.customThemes[customId] = customTheme;
    this.saveCustomThemes();
    this.notifyListeners();
    
    return customId;
  }

  // Update custom theme
  updateCustomTheme(themeId, updates) {
    if (!this.customThemes[themeId]) {
      throw new Error(`Custom theme '${themeId}' not found`);
    }

    this.customThemes[themeId] = {
      ...this.customThemes[themeId],
      ...updates,
      colors: {
        ...this.customThemes[themeId].colors,
        ...(updates.colors || {})
      }
    };

    this.saveCustomThemes();
    
    // If it's the current theme, reapply it
    if (this.currentTheme === themeId) {
      this.applyTheme(themeId);
    }
    
    this.notifyListeners();
  }

  // Delete custom theme
  deleteCustomTheme(themeId) {
    if (!this.customThemes[themeId]) {
      throw new Error(`Custom theme '${themeId}' not found`);
    }

    delete this.customThemes[themeId];
    this.saveCustomThemes();

    // If it was the current theme, switch to default
    if (this.currentTheme === themeId) {
      this.setTheme('vscode-dark');
    }

    this.notifyListeners();
  }

  // Export theme as JSON
  exportTheme(themeId) {
    const theme = this.getTheme(themeId);
    if (!theme) {
      throw new Error(`Theme '${themeId}' not found`);
    }

    return JSON.stringify({ [themeId]: theme }, null, 2);
  }

  // Import theme from JSON
  importTheme(themeJson) {
    try {
      const themes = JSON.parse(themeJson);
      let importedCount = 0;

      Object.entries(themes).forEach(([themeId, themeData]) => {
        // Validate theme structure
        if (!themeData.name || !themeData.colors || !themeData.type) {
          log.warn('importThemes', `Invalid theme structure for '${themeId}', skipping`, { themeId, themeData });
          return;
        }

        // Create as custom theme
        const customId = `imported-${themeId}-${Date.now()}`;
        this.customThemes[customId] = {
          ...themeData,
          custom: true,
          imported: true
        };
        importedCount++;
      });

      if (importedCount > 0) {
        this.saveCustomThemes();
        this.notifyListeners();
      }

      return importedCount;
    } catch (error) {
      throw new Error(`Failed to import theme: ${error.message}`);
    }
  }

  // Add theme change listener
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove theme change listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners of theme changes
  notifyListeners(themeId = null) {
    this.listeners.forEach(callback => {
      try {
        callback(themeId || this.currentTheme, this.getTheme(themeId || this.currentTheme));
      } catch (error) {
        log.error('notifyListeners', 'Error in theme listener', { error });
      }
    });
  }

  // Get color palette for the current theme
  getCurrentColors() {
    return this.getTheme(this.currentTheme).colors;
  }

  // Get a specific color from the current theme
  getColor(colorName) {
    const colors = this.getCurrentColors();
    return colors[colorName] || null;
  }

  // Check if current theme is dark
  isDarkTheme() {
    return this.getTheme(this.currentTheme).type === 'dark';
  }

  // Check if current theme is light
  isLightTheme() {
    return this.getTheme(this.currentTheme).type === 'light';
  }
}

// Create singleton instance
const themeService = new ThemeService();

// Initialize theme on load
if (typeof window !== 'undefined') {
  themeService.loadSavedTheme();
}

export default themeService;
