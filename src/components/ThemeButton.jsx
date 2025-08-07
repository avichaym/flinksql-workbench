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

  return (
    <>
      <button
        onClick={() => setShowThemeSelector(true)}
        className={`btn-icon-only btn-secondary ${className}`}
        title={`Current theme: ${currentThemeData.name}`}
      >
        <Palette className="w-4 h-4" />
      </button>
      
      <ThemeSelector
        isOpen={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
      />
    </>
  );
};

export default ThemeButton;
