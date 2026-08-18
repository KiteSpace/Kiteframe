import { useEffect, useCallback, useRef } from 'react';
import { useEventCleanup } from '../utils/eventCleanup';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  description?: string;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: 'window' | 'canvas' | HTMLElement;
}

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const { enabled = true, target = 'window' } = options;
  const shortcutsRef = useRef(shortcuts);
  const cleanupManager = useEventCleanup();
  
  // Update shortcuts ref when they change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Check if input/textarea is focused
    const activeElement = document.activeElement;
    if (
      activeElement?.tagName === 'INPUT' ||
      activeElement?.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement)?.contentEditable === 'true'
    ) {
      return;
    }

    // Find matching shortcut
    const matchingShortcut = shortcutsRef.current.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.shift === undefined || shortcut.shift === event.shiftKey;
      const altMatch = shortcut.alt === undefined || shortcut.alt === event.altKey;
      const metaMatch = shortcut.meta === undefined || shortcut.meta === event.metaKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
    });

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault();
      }
      matchingShortcut.handler(event);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const targetElement = 
      target === 'window' ? window :
      target === 'canvas' ? document.getElementById('kiteframe-canvas') :
      target;

    if (!targetElement) return;

    // Use cleanup manager for event listener
    const cleanup = cleanupManager.addEventListener(targetElement, 'keydown', handleKeyDown as any);

    return cleanup;
  }, [enabled, target, handleKeyDown, cleanupManager]);

  return {
    getShortcutDescription: (key: string, modifiers?: {
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
      meta?: boolean;
    }) => {
      const parts = [];
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      
      if (modifiers?.ctrl) parts.push(isMac ? 'Cmd' : 'Ctrl');
      if (modifiers?.shift) parts.push('Shift');
      if (modifiers?.alt) parts.push(isMac ? 'Option' : 'Alt');
      if (modifiers?.meta && !isMac) parts.push('Meta');
      
      parts.push(key.toUpperCase());
      
      return parts.join('+');
    }
  };
};

// Common keyboard shortcuts for workflow editor
export const defaultKeyboardShortcuts = {
  // Selection
  selectAll: { key: 'a', ctrl: true, description: 'Select all nodes' },
  deselectAll: { key: 'Escape', description: 'Deselect all' },
  
  // Editing
  deleteSelected: { key: 'Delete', description: 'Delete selected items' },
  deleteSelectedAlt: { key: 'Backspace', description: 'Delete selected items' },
  
  // Clipboard
  copy: { key: 'c', ctrl: true, description: 'Copy selected' },
  cut: { key: 'x', ctrl: true, description: 'Cut selected' },
  paste: { key: 'v', ctrl: true, description: 'Paste' },
  duplicate: { key: 'd', ctrl: true, description: 'Duplicate selected' },
  
  // Undo/Redo
  undo: { key: 'z', ctrl: true, description: 'Undo' },
  redo: { key: 'z', ctrl: true, shift: true, description: 'Redo' },
  redoAlt: { key: 'y', ctrl: true, description: 'Redo' },
  
  // Zoom
  zoomIn: { key: '+', ctrl: true, description: 'Zoom in' },
  zoomInAlt: { key: '=', ctrl: true, description: 'Zoom in' },
  zoomOut: { key: '-', ctrl: true, description: 'Zoom out' },
  zoomReset: { key: '0', ctrl: true, description: 'Reset zoom' },
  zoomToFit: { key: '1', ctrl: true, description: 'Fit to screen' },
  
  // Save
  save: { key: 's', ctrl: true, description: 'Save workflow' },
  saveAs: { key: 's', ctrl: true, shift: true, description: 'Save as' },
  
  // Navigation
  panMode: { key: ' ', description: 'Hold for pan mode' },
  
  // Node operations
  addNode: { key: 'n', description: 'Add new node' },
  editNode: { key: 'Enter', description: 'Edit selected node' },
  
  // View
  toggleGrid: { key: 'g', ctrl: true, description: 'Toggle grid' },
  toggleMinimap: { key: 'm', ctrl: true, description: 'Toggle minimap' },
  toggleDebug: { key: 'd', ctrl: true, shift: true, description: 'Toggle debug mode' }
};