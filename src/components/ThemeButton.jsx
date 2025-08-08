import React, { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';
import themeService from '../services/themeService.js';
import ThemeSelector from './ThemeSelector.jsx';

const ThemeButton = ({ className = '' }) => {
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(themeService.getCurrentTheme());

  useEffect(() => {
    const handleThemeChange = (themeId) => {
      setCurrentTheme(themeId);
    };

    themeService.addListener(handleThemeChange);
    return () => themeService.removeListener(handleThemeChange);
  }, []);

  const currentThemeData = themeService.getTheme(currentTheme);

  // Layout save/reset handlers
  const handleSaveLayout = () => {
    if (window && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('saveLayout'));
    }
  };

  const handleResetLayout = () => {
    if (window && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('resetLayout'));
    }
  };

  return (
    <>
      <button
        onClick={() => setShowThemeSelector(true)}
        className={`btn-icon-only btn-secondary ${className}`}
        title={`Current theme: ${currentThemeData.name}`}
      >
        <Palette className="w-4 h-4" />
      </button>
      <button
        onClick={handleSaveLayout}
        className={`btn-icon-only btn-secondary mx-1`}
        title="Save layout"
      >
        💾
      </button>
      <button
        onClick={handleResetLayout}
        className={`btn-icon-only btn-secondary mx-1`}
        title="Reset layout"
      >
        ♻️
      </button>
      <ThemeSelector
        isOpen={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
      />
    </>
  );
};

export default ThemeButton;
