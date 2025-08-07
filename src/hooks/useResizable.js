import { useState, useCallback, useEffect } from 'react';

export const useResizable = (initialSize, minSize = 100, maxSize = null, direction = 'vertical', context = 'default') => {
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);

  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const stopResize = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback((e) => {
    if (!isDragging) return;

    let newSize;

    if (direction === 'vertical') {
      if (context === 'sidebar') {
        // Sidebar resizing relative to app-content
        const container = document.querySelector('.app-content');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        newSize = e.clientX - rect.left;
      } else if (context === 'editor-results') {
        // Editor/Results resizing relative to main-content
        const container = document.querySelector('.main-content');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        newSize = e.clientX - rect.left;
      }
    } else if (direction === 'horizontal') {
      if (context === 'catalog-snippets' || context === 'catalog-in-three-panel' || context === 'jobs-in-three-panel') {
        // Catalog/Jobs/Snippets resizing within sidebar
        const container = document.querySelector('.sidebar-split');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        newSize = e.clientY - rect.top;
      } else {
        // Bottom panel resizing
        const container = document.querySelector('.main-area');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        newSize = rect.bottom - e.clientY;
      }
    }

    // Apply constraints
    newSize = Math.max(minSize, newSize);
    if (maxSize) {
      if (typeof maxSize === 'string' && maxSize.endsWith('%')) {
        // Handle percentage maxSize for sidebar context
        if (context === 'catalog-snippets' || context === 'catalog-in-three-panel' || context === 'jobs-in-three-panel') {
          const container = document.querySelector('.sidebar-split');
          if (container) {
            const containerHeight = container.getBoundingClientRect().height;
            const percentageValue = parseFloat(maxSize) / 100;
            newSize = Math.min(newSize, containerHeight * percentageValue);
          }
        }
      } else {
        newSize = Math.min(maxSize, newSize);
      }
    }

    setSize(newSize);
  }, [isDragging, minSize, maxSize, direction, context]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
      document.body.style.cursor = direction === 'horizontal' ? 'ns-resize' : 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, resize, stopResize, direction]);

  return { size, startResize, isDragging };
};
