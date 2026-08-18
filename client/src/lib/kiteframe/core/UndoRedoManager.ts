import { Node, Edge } from '../types';
import { getGlobalTelemetry, TelemetryEventType } from '../utils/telemetry';

export interface Command {
  id: string;
  type: string;
  timestamp: number;
  execute: () => void;
  undo: () => void;
  redo: () => void;
  description?: string;
}

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
}

export interface UndoRedoOptions {
  maxHistorySize?: number;
  debounceDelay?: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export class UndoRedoManager {
  private history: Command[] = [];
  private currentIndex = -1;
  private maxHistorySize: number;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay: number;
  private onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  private isExecutingCommand = false;

  constructor(options: UndoRedoOptions = {}) {
    this.maxHistorySize = options.maxHistorySize || 50;
    this.debounceDelay = options.debounceDelay || 300;
    this.onHistoryChange = options.onHistoryChange;
  }

  /**
   * Execute a command and add it to history
   */
  execute(command: Command): void {
    if (this.isExecutingCommand) return;

    const telemetry = getGlobalTelemetry();
    const startTime = performance.now();

    try {
      this.isExecutingCommand = true;
      
      // Execute the command
      command.execute();
      
      // Track command execution
      telemetry.track(TelemetryEventType.USER_ACTION, {
        category: 'undo-redo',
        action: 'execute',
        label: command.type,
        duration: performance.now() - startTime,
        metadata: {
          commandId: command.id,
          commandType: command.type,
          description: command.description
        }
      });

      // Remove any commands after current index (for redo functionality)
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }

      // Add command to history
      this.history.push(command);
      this.currentIndex++;

      // Enforce max history size
      if (this.history.length > this.maxHistorySize) {
        const overflow = this.history.length - this.maxHistorySize;
        this.history = this.history.slice(overflow);
        this.currentIndex -= overflow;
      }

      this.notifyHistoryChange();
    } finally {
      this.isExecutingCommand = false;
    }
  }

  /**
   * Execute a command with debouncing (useful for continuous operations like dragging)
   */
  executeDebounced(command: Command): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.execute(command);
      this.debounceTimer = null;
    }, this.debounceDelay);
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    if (!this.canUndo() || this.isExecutingCommand) return false;

    const telemetry = getGlobalTelemetry();
    const startTime = performance.now();

    try {
      this.isExecutingCommand = true;
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;
      this.notifyHistoryChange();
      
      // Track undo operation
      telemetry.track(TelemetryEventType.USER_ACTION, {
        category: 'undo-redo',
        action: 'undo',
        label: command.type,
        duration: performance.now() - startTime,
        metadata: {
          commandId: command.id,
          commandType: command.type,
          description: command.description,
          historySize: this.history.length,
          currentIndex: this.currentIndex
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error during undo:', error);
      
      // Track undo error
      telemetry.track(TelemetryEventType.ERROR, {
        category: 'undo-redo',
        action: 'undo-failed',
        error: error as Error,
        metadata: {
          currentIndex: this.currentIndex,
          historySize: this.history.length
        }
      });
      
      return false;
    } finally {
      this.isExecutingCommand = false;
    }
  }

  /**
   * Redo the next command
   */
  redo(): boolean {
    if (!this.canRedo() || this.isExecutingCommand) return false;

    const telemetry = getGlobalTelemetry();
    const startTime = performance.now();

    try {
      this.isExecutingCommand = true;
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.redo();
      this.notifyHistoryChange();
      
      // Track redo operation
      telemetry.track(TelemetryEventType.USER_ACTION, {
        category: 'undo-redo',
        action: 'redo',
        label: command.type,
        duration: performance.now() - startTime,
        metadata: {
          commandId: command.id,
          commandType: command.type,
          description: command.description,
          historySize: this.history.length,
          currentIndex: this.currentIndex
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error during redo:', error);
      this.currentIndex--;
      
      // Track redo error
      telemetry.track(TelemetryEventType.ERROR, {
        category: 'undo-redo',
        action: 'redo-failed',
        error: error as Error,
        metadata: {
          currentIndex: this.currentIndex,
          historySize: this.history.length
        }
      });
      
      return false;
    } finally {
      this.isExecutingCommand = false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Clear all history
   */
  clear(): void {
    const telemetry = getGlobalTelemetry();
    const previousSize = this.history.length;
    
    this.history = [];
    this.currentIndex = -1;
    this.notifyHistoryChange();
    
    // Track history clear
    telemetry.track(TelemetryEventType.USER_ACTION, {
      category: 'undo-redo',
      action: 'clear-history',
      value: previousSize,
      metadata: {
        previousSize
      }
    });
  }

  /**
   * Get history information
   */
  getHistoryInfo(): { total: number; current: number; commands: string[] } {
    return {
      total: this.history.length,
      current: this.currentIndex + 1,
      commands: this.history.map(cmd => cmd.description || cmd.type)
    };
  }

  /**
   * Create a batch command that groups multiple commands
   */
  batch(commands: Command[], description?: string): Command {
    const batchId = `batch-${Date.now()}`;
    return {
      id: batchId,
      type: 'batch',
      timestamp: Date.now(),
      description: description || `Batch operation (${commands.length} actions)`,
      execute: () => {
        commands.forEach(cmd => cmd.execute());
      },
      undo: () => {
        // Undo in reverse order
        for (let i = commands.length - 1; i >= 0; i--) {
          commands[i].undo();
        }
      },
      redo: () => {
        commands.forEach(cmd => cmd.redo());
      }
    };
  }

  /**
   * Create a checkpoint for complex operations
   */
  checkpoint(getState: () => CanvasState, setState: (state: CanvasState) => void, description?: string): Command {
    const beforeState = getState();
    return {
      id: `checkpoint-${Date.now()}`,
      type: 'checkpoint',
      timestamp: Date.now(),
      description: description || 'Checkpoint',
      execute: () => {
        // State is already changed, just capture it
      },
      undo: () => {
        setState(beforeState);
      },
      redo: () => {
        const afterState = getState();
        setState(afterState);
      }
    };
  }

  private notifyHistoryChange(): void {
    if (this.onHistoryChange) {
      this.onHistoryChange(this.canUndo(), this.canRedo());
    }
  }
}

// Command factory functions for common operations
export class CommandFactory {
  static createNodeCommand(
    action: 'add' | 'delete' | 'update',
    node: Node,
    previousNode?: Node,
    callbacks?: {
      onAdd?: (node: Node) => void;
      onDelete?: (nodeId: string) => void;
      onUpdate?: (node: Node) => void;
    }
  ): Command {
    return {
      id: `node-${action}-${node.id}-${Date.now()}`,
      type: `node-${action}`,
      timestamp: Date.now(),
      description: `${action} node "${node.data?.label || node.id}"`,
      execute: () => {
        switch (action) {
          case 'add':
            callbacks?.onAdd?.(node);
            break;
          case 'delete':
            callbacks?.onDelete?.(node.id);
            break;
          case 'update':
            callbacks?.onUpdate?.(node);
            break;
        }
      },
      undo: () => {
        switch (action) {
          case 'add':
            callbacks?.onDelete?.(node.id);
            break;
          case 'delete':
            callbacks?.onAdd?.(node);
            break;
          case 'update':
            if (previousNode) {
              callbacks?.onUpdate?.(previousNode);
            }
            break;
        }
      },
      redo: () => {
        switch (action) {
          case 'add':
            callbacks?.onAdd?.(node);
            break;
          case 'delete':
            callbacks?.onDelete?.(node.id);
            break;
          case 'update':
            callbacks?.onUpdate?.(node);
            break;
        }
      }
    };
  }

  static createEdgeCommand(
    action: 'add' | 'delete' | 'update',
    edge: Edge,
    previousEdge?: Edge,
    callbacks?: {
      onAdd?: (edge: Edge) => void;
      onDelete?: (edgeId: string) => void;
      onUpdate?: (edge: Edge) => void;
    }
  ): Command {
    return {
      id: `edge-${action}-${edge.id}-${Date.now()}`,
      type: `edge-${action}`,
      timestamp: Date.now(),
      description: `${action} edge "${edge.label || edge.id}"`,
      execute: () => {
        switch (action) {
          case 'add':
            callbacks?.onAdd?.(edge);
            break;
          case 'delete':
            callbacks?.onDelete?.(edge.id);
            break;
          case 'update':
            callbacks?.onUpdate?.(edge);
            break;
        }
      },
      undo: () => {
        switch (action) {
          case 'add':
            callbacks?.onDelete?.(edge.id);
            break;
          case 'delete':
            callbacks?.onAdd?.(edge);
            break;
          case 'update':
            if (previousEdge) {
              callbacks?.onUpdate?.(previousEdge);
            }
            break;
        }
      },
      redo: () => {
        switch (action) {
          case 'add':
            callbacks?.onAdd?.(edge);
            break;
          case 'delete':
            callbacks?.onDelete?.(edge.id);
            break;
          case 'update':
            callbacks?.onUpdate?.(edge);
            break;
        }
      }
    };
  }

  static createMoveNodesCommand(
    nodes: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>,
    callback: (nodeId: string, position: { x: number; y: number }) => void
  ): Command {
    return {
      id: `move-nodes-${Date.now()}`,
      type: 'move-nodes',
      timestamp: Date.now(),
      description: `Move ${nodes.length} node(s)`,
      execute: () => {
        nodes.forEach(node => callback(node.id, node.to));
      },
      undo: () => {
        nodes.forEach(node => callback(node.id, node.from));
      },
      redo: () => {
        nodes.forEach(node => callback(node.id, node.to));
      }
    };
  }
}