import React, { useState, useCallback } from 'react';
import { Node, Edge } from '../types';
import { ContextMenuItem } from '../components/ContextMenu';

export interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  targetType?: 'node' | 'edge' | 'canvas';
  targetId?: string;
}

export interface UseContextMenuOptions {
  onNodeEdit?: (nodeId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onNodeDuplicate?: (nodeId: string) => void;
  onNodeCopy?: (nodeId: string) => void;
  onNodePaste?: () => void;
  onEdgeEdit?: (edgeId: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onCanvasAddNode?: (position: { x: number; y: number }) => void;
  onCanvasPaste?: (position: { x: number; y: number }) => void;
  onSelectAll?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  customNodeActions?: (node: Node) => ContextMenuItem[];
  customEdgeActions?: (edge: Edge) => ContextMenuItem[];
  customCanvasActions?: () => ContextMenuItem[];
}

export const useContextMenu = (options: UseContextMenuOptions = {}) => {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: []
  });

  const openNodeContextMenu = useCallback(
    (node: Node, position: { x: number; y: number }) => {
      const items: ContextMenuItem[] = [];

      // Standard node actions
      if (options.onNodeEdit) {
        items.push({
          id: 'edit',
          label: 'Edit',
          icon: '✏️',
          shortcut: 'Enter',
          onClick: () => options.onNodeEdit!(node.id)
        });
      }

      if (options.onNodeDuplicate) {
        items.push({
          id: 'duplicate',
          label: 'Duplicate',
          icon: '📋',
          shortcut: 'Ctrl+D',
          onClick: () => options.onNodeDuplicate!(node.id)
        });
      }

      if (options.onNodeCopy) {
        items.push({
          id: 'copy',
          label: 'Copy',
          icon: '📄',
          shortcut: 'Ctrl+C',
          onClick: () => options.onNodeCopy!(node.id)
        });
      }

      if (items.length > 0 && options.onNodeDelete) {
        items.push({ id: 'separator-1', separator: true, label: '' });
      }

      if (options.onNodeDelete) {
        items.push({
          id: 'delete',
          label: 'Delete',
          icon: '🗑️',
          shortcut: 'Del',
          onClick: () => options.onNodeDelete!(node.id)
        });
      }

      // Add custom node actions
      if (options.customNodeActions) {
        const customItems = options.customNodeActions(node);
        if (customItems.length > 0) {
          items.push({ id: 'separator-custom', separator: true, label: '' });
          items.push(...customItems);
        }
      }

      setMenuState({
        isOpen: true,
        position,
        items,
        targetType: 'node',
        targetId: node.id
      });
    },
    [options]
  );

  const openEdgeContextMenu = useCallback(
    (edge: Edge, position: { x: number; y: number }) => {
      const items: ContextMenuItem[] = [];

      // Standard edge actions
      if (options.onEdgeEdit) {
        items.push({
          id: 'edit',
          label: 'Edit Properties',
          icon: '⚙️',
          onClick: () => options.onEdgeEdit!(edge.id)
        });
      }

      if (options.onEdgeDelete) {
        if (items.length > 0) {
          items.push({ id: 'separator-1', separator: true, label: '' });
        }
        items.push({
          id: 'delete',
          label: 'Delete Connection',
          icon: '🗑️',
          shortcut: 'Del',
          onClick: () => options.onEdgeDelete!(edge.id)
        });
      }

      // Add custom edge actions
      if (options.customEdgeActions) {
        const customItems = options.customEdgeActions(edge);
        if (customItems.length > 0) {
          items.push({ id: 'separator-custom', separator: true, label: '' });
          items.push(...customItems);
        }
      }

      setMenuState({
        isOpen: true,
        position,
        items,
        targetType: 'edge',
        targetId: edge.id
      });
    },
    [options]
  );

  const openCanvasContextMenu = useCallback(
    (position: { x: number; y: number }) => {
      const items: ContextMenuItem[] = [];

      // Canvas actions
      if (options.onCanvasAddNode) {
        items.push({
          id: 'add-node',
          label: 'Add Node',
          icon: '➕',
          shortcut: 'N',
          onClick: () => options.onCanvasAddNode!(position)
        });
      }

      if (options.onCanvasPaste) {
        items.push({
          id: 'paste',
          label: 'Paste',
          icon: '📋',
          shortcut: 'Ctrl+V',
          onClick: () => options.onCanvasPaste!(position)
        });
      }

      if (options.onSelectAll) {
        if (items.length > 0) {
          items.push({ id: 'separator-1', separator: true, label: '' });
        }
        items.push({
          id: 'select-all',
          label: 'Select All',
          icon: '⬚',
          shortcut: 'Ctrl+A',
          onClick: () => options.onSelectAll!()
        });
      }

      // Zoom actions
      if (options.onZoomIn || options.onZoomOut || options.onZoomReset) {
        if (items.length > 0) {
          items.push({ id: 'separator-zoom', separator: true, label: '' });
        }

        if (options.onZoomIn) {
          items.push({
            id: 'zoom-in',
            label: 'Zoom In',
            icon: '🔍',
            shortcut: 'Ctrl++',
            onClick: () => options.onZoomIn!()
          });
        }

        if (options.onZoomOut) {
          items.push({
            id: 'zoom-out',
            label: 'Zoom Out',
            icon: '🔍',
            shortcut: 'Ctrl+-',
            onClick: () => options.onZoomOut!()
          });
        }

        if (options.onZoomReset) {
          items.push({
            id: 'zoom-reset',
            label: 'Reset Zoom',
            icon: '🔄',
            shortcut: 'Ctrl+0',
            onClick: () => options.onZoomReset!()
          });
        }
      }

      // Add custom canvas actions
      if (options.customCanvasActions) {
        const customItems = options.customCanvasActions();
        if (customItems.length > 0) {
          items.push({ id: 'separator-custom', separator: true, label: '' });
          items.push(...customItems);
        }
      }

      setMenuState({
        isOpen: true,
        position,
        items,
        targetType: 'canvas'
      });
    },
    [options]
  );

  const closeContextMenu = useCallback(() => {
    setMenuState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    menuState,
    openNodeContextMenu,
    openEdgeContextMenu,
    openCanvasContextMenu,
    closeContextMenu
  };
};