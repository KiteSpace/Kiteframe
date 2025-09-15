import { useRef, useCallback, useEffect } from 'react';
import { UndoRedoManager, Command, CommandFactory } from '../core/UndoRedoManager';
import { Node, Edge } from '../types';

export interface UseUndoRedoOptions {
  maxHistorySize?: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  shortcuts?: boolean;
}

export interface UseUndoRedoCallbacks {
  onAddNode?: (node: Node) => void;
  onDeleteNode?: (nodeId: string) => void;
  onUpdateNode?: (node: Node) => void;
  onAddEdge?: (edge: Edge) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onUpdateEdge?: (edge: Edge) => void;
  onMoveNode?: (nodeId: string, position: { x: number; y: number }) => void;
}

export function useUndoRedo(
  callbacks: UseUndoRedoCallbacks,
  options: UseUndoRedoOptions = {}
) {
  const managerRef = useRef<UndoRedoManager>();
  
  // Initialize manager
  if (!managerRef.current) {
    managerRef.current = new UndoRedoManager({
      maxHistorySize: options.maxHistorySize,
      onHistoryChange: options.onHistoryChange
    });
  }

  // Node operations
  const addNode = useCallback((node: Node) => {
    const command = CommandFactory.createNodeCommand('add', node, undefined, {
      onAdd: callbacks.onAddNode,
      onDelete: callbacks.onDeleteNode
    });
    managerRef.current?.execute(command);
  }, [callbacks.onAddNode, callbacks.onDeleteNode]);

  const deleteNode = useCallback((node: Node) => {
    const command = CommandFactory.createNodeCommand('delete', node, undefined, {
      onAdd: callbacks.onAddNode,
      onDelete: callbacks.onDeleteNode
    });
    managerRef.current?.execute(command);
  }, [callbacks.onAddNode, callbacks.onDeleteNode]);

  const updateNode = useCallback((node: Node, previousNode: Node) => {
    const command = CommandFactory.createNodeCommand('update', node, previousNode, {
      onUpdate: callbacks.onUpdateNode
    });
    managerRef.current?.execute(command);
  }, [callbacks.onUpdateNode]);

  // Edge operations
  const addEdge = useCallback((edge: Edge) => {
    const command = CommandFactory.createEdgeCommand('add', edge, undefined, {
      onAdd: callbacks.onAddEdge,
      onDelete: callbacks.onDeleteEdge
    });
    managerRef.current?.execute(command);
  }, [callbacks.onAddEdge, callbacks.onDeleteEdge]);

  const deleteEdge = useCallback((edge: Edge) => {
    const command = CommandFactory.createEdgeCommand('delete', edge, undefined, {
      onAdd: callbacks.onAddEdge,
      onDelete: callbacks.onDeleteEdge
    });
    managerRef.current?.execute(command);
  }, [callbacks.onAddEdge, callbacks.onDeleteEdge]);

  const updateEdge = useCallback((edge: Edge, previousEdge: Edge) => {
    const command = CommandFactory.createEdgeCommand('update', edge, previousEdge, {
      onUpdate: callbacks.onUpdateEdge
    });
    managerRef.current?.execute(command);
  }, [callbacks.onUpdateEdge]);

  // Move operations
  const moveNodes = useCallback((
    moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>
  ) => {
    if (!callbacks.onMoveNode) return;
    
    const command = CommandFactory.createMoveNodesCommand(moves, callbacks.onMoveNode);
    managerRef.current?.execute(command);
  }, [callbacks.onMoveNode]);

  const moveNodesDebounced = useCallback((
    moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>
  ) => {
    if (!callbacks.onMoveNode) return;
    
    const command = CommandFactory.createMoveNodesCommand(moves, callbacks.onMoveNode);
    managerRef.current?.executeDebounced(command);
  }, [callbacks.onMoveNode]);

  // Batch operations
  const batch = useCallback((operations: (() => void)[], description?: string) => {
    const commands: Command[] = [];
    
    // Temporarily capture commands instead of executing them
    const originalExecute = managerRef.current?.execute;
    const capturedCommands: Command[] = [];
    
    if (managerRef.current) {
      managerRef.current.execute = (cmd: Command) => {
        capturedCommands.push(cmd);
      };
    }
    
    // Run operations to capture commands
    operations.forEach(op => op());
    
    // Restore original execute
    if (managerRef.current && originalExecute) {
      managerRef.current.execute = originalExecute;
    }
    
    // Create and execute batch command
    if (capturedCommands.length > 0 && managerRef.current) {
      const batchCommand = managerRef.current.batch(capturedCommands, description);
      managerRef.current.execute(batchCommand);
    }
  }, []);

  // Undo/Redo operations
  const undo = useCallback(() => {
    return managerRef.current?.undo() || false;
  }, []);

  const redo = useCallback(() => {
    return managerRef.current?.redo() || false;
  }, []);

  const canUndo = useCallback(() => {
    return managerRef.current?.canUndo() || false;
  }, []);

  const canRedo = useCallback(() => {
    return managerRef.current?.canRedo() || false;
  }, []);

  const clear = useCallback(() => {
    managerRef.current?.clear();
  }, []);

  const getHistoryInfo = useCallback(() => {
    return managerRef.current?.getHistoryInfo() || { total: 0, current: 0, commands: [] };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!options.shortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if input is focused
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (modKey && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options.shortcuts, undo, redo]);

  return {
    // Node operations
    addNode,
    deleteNode,
    updateNode,
    
    // Edge operations
    addEdge,
    deleteEdge,
    updateEdge,
    
    // Move operations
    moveNodes,
    moveNodesDebounced,
    
    // Batch operations
    batch,
    
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    getHistoryInfo,
    
    // Direct manager access for advanced use cases
    manager: managerRef.current
  };
}