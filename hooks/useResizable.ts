
import React, { useState, useCallback } from 'react';

export const useResizable = () => {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(500);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [splitRatio, setSplitRatio] = useState(50);

  const startResizing = useCallback((direction: 'sidebar' | 'rightPanel' | 'bottomPanel' | 'split', e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startSidebarWidth = sidebarWidth;
      const startRightWidth = rightPanelWidth;
      const startBottomHeight = bottomPanelHeight;
      const startSplitRatio = splitRatio;
      const editorContainerWidth = document.getElementById('editor-container')?.clientWidth || 800;

      const onMouseMove = (moveEvent: MouseEvent) => {
          if (direction === 'sidebar') {
              const newWidth = Math.max(180, Math.min(500, startSidebarWidth + (moveEvent.clientX - startX)));
              setSidebarWidth(newWidth);
          } else if (direction === 'rightPanel') {
              const newWidth = Math.max(300, Math.min(1000, startRightWidth - (moveEvent.clientX - startX)));
              setRightPanelWidth(newWidth);
          } else if (direction === 'bottomPanel') {
              const newHeight = Math.max(100, Math.min(600, startBottomHeight - (moveEvent.clientY - startY)));
              setBottomPanelHeight(newHeight);
          } else if (direction === 'split') {
              const deltaPixels = moveEvent.clientX - startX;
              const deltaPercent = (deltaPixels / editorContainerWidth) * 100;
              const newRatio = Math.max(20, Math.min(80, startSplitRatio + deltaPercent));
              setSplitRatio(newRatio);
          }
      };

      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'default';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = direction === 'bottomPanel' ? 'ns-resize' : 'col-resize';
  }, [sidebarWidth, rightPanelWidth, bottomPanelHeight, splitRatio]);

  return {
    sidebarWidth, setSidebarWidth,
    rightPanelWidth, setRightPanelWidth,
    bottomPanelHeight, setBottomPanelHeight,
    splitRatio, setSplitRatio,
    startResizing
  };
};