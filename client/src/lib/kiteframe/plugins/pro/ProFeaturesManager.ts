import type { Node, ProFeaturesConfig, NodeType } from '../../types';

/**
 * ProFeaturesManager - Centralized manager for all premium features
 * This class provides a clean API for managing pro feature functionality
 * without global DOM manipulation or event listeners.
 */
export class ProFeaturesManager {
  private config: ProFeaturesConfig;
  private nodes: Node[];
  private onNodesChange: (nodes: Node[]) => void;
  private onConnect?: (connection: { source: string; target: string }) => void;

  constructor(
    config: ProFeaturesConfig,
    nodes: Node[],
    onNodesChange: (nodes: Node[]) => void,
    onConnect?: (connection: { source: string; target: string }) => void
  ) {
    this.config = config;
    this.nodes = nodes;
    this.onNodesChange = onNodesChange;
    this.onConnect = onConnect;
  }

  // Quick Add Feature
  isQuickAddEnabled(): boolean {
    return this.config.quickAdd?.enabled !== false;
  }

  createQuickAddNode(sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left'): Node {
    const quickAddConfig = this.config.quickAdd;
    const spacing = quickAddConfig?.defaultSpacing ?? 250;
    const nodeType = quickAddConfig?.defaultNodeType ?? 'process';
    const template = quickAddConfig?.defaultNodeTemplate ?? {};
    
    let newPosition = { x: 0, y: 0 };
    switch (position) {
      case 'top':
        newPosition = { x: sourceNode.position.x, y: sourceNode.position.y - spacing };
        break;
      case 'right':
        newPosition = { x: sourceNode.position.x + spacing, y: sourceNode.position.y };
        break;
      case 'bottom':
        newPosition = { x: sourceNode.position.x, y: sourceNode.position.y + spacing };
        break;
      case 'left':
        newPosition = { x: sourceNode.position.x - spacing, y: sourceNode.position.y };
        break;
    }

    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      position: newPosition,
      data: {
        label: 'New Process',
        description: 'Configure process settings',
        icon: 'Cog',
        iconColor: 'text-gray-500',
        ...template
      },
      width: 200,
      height: 100
    };

    return newNode;
  }

  handleQuickAdd(sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left'): void {
    if (!this.isQuickAddEnabled()) return;

    const newNode = this.createQuickAddNode(sourceNode, position);
    
    // Add the new node
    const updatedNodes = [...this.nodes, newNode];
    this.onNodesChange(updatedNodes);

    // Create connecting edge if handler exists
    if (this.onConnect) {
      this.onConnect({ source: sourceNode.id, target: newNode.id });
    }

    // Call custom handler if provided
    if (this.config.quickAdd?.onQuickAdd) {
      this.config.quickAdd.onQuickAdd(sourceNode, position, newNode);
    }
  }

  // Copy/Paste Feature
  isCopyPasteEnabled(): boolean {
    return this.config.copyPaste?.enabled !== false;
  }

  copyNode(node: Node): void {
    if (!this.isCopyPasteEnabled()) return;

    // Store in localStorage for cross-component access
    localStorage.setItem('kiteframe-copied-node', JSON.stringify(node));
    
    // Call custom handler if provided
    if (this.config.copyPaste?.onCopy) {
      this.config.copyPaste.onCopy(node);
    }
  }

  pasteNode(): Node | null {
    if (!this.isCopyPasteEnabled()) return null;

    const copiedNodeStr = localStorage.getItem('kiteframe-copied-node');
    if (!copiedNodeStr) return null;

    try {
      const copiedNode = JSON.parse(copiedNodeStr) as Node;
      const offsetDistance = this.config.copyPaste?.offsetDistance ?? 50;
      
      const newNode: Node = {
        ...copiedNode,
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: {
          x: copiedNode.position.x + offsetDistance,
          y: copiedNode.position.y + offsetDistance
        },
        selected: false // Ensure copied node is not selected
      };

      // Add the new node
      const updatedNodes = [...this.nodes, newNode];
      this.onNodesChange(updatedNodes);

      // Call custom handler if provided
      if (this.config.copyPaste?.onPaste) {
        this.config.copyPaste.onPaste(copiedNode, newNode);
      }

      return newNode;
    } catch (error) {
      console.error('Failed to paste node:', error);
      return null;
    }
  }

  // Advanced Selection Feature
  isAdvancedSelectionEnabled(): boolean {
    return this.config.advancedSelection?.enabled !== false;
  }

  isMultiSelectEnabled(): boolean {
    return this.isAdvancedSelectionEnabled() && 
           this.config.advancedSelection?.enableMultiSelect !== false;
  }

  isShiftDragSelectionEnabled(): boolean {
    return this.isAdvancedSelectionEnabled() && 
           this.config.advancedSelection?.enableShiftDragSelection !== false;
  }

  getSelectionRectStyle(): React.CSSProperties {
    return this.config.advancedSelection?.selectionRectStyle ?? {
      border: '2px dashed #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderRadius: '4px'
    };
  }

  // Version Control Feature
  isVersionControlEnabled(): boolean {
    return this.config.versionControl?.enabled !== false;
  }

  getAutoSaveInterval(): number {
    return this.config.versionControl?.autoSaveInterval ?? 30000; // 30 seconds default
  }

  getMaxSnapshots(): number {
    return this.config.versionControl?.maxSnapshots ?? 50;
  }

  isComparisonEnabled(): boolean {
    return this.isVersionControlEnabled() && 
           this.config.versionControl?.enableComparison !== false;
  }

  handleSnapshot(snapshot: any): void {
    if (!this.isVersionControlEnabled()) return;

    // Call custom handler if provided
    if (this.config.versionControl?.onSnapshot) {
      this.config.versionControl.onSnapshot(snapshot);
    }
  }

  // Keyboard shortcuts handler
  handleKeyboardShortcut(event: KeyboardEvent, selectedNodes: Node[]): boolean {
    if (!this.isCopyPasteEnabled()) return false;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? event.metaKey : event.ctrlKey;

    if (cmdKey && event.key === 'c' && selectedNodes.length > 0) {
      // Copy selected node (first one if multiple selected)
      this.copyNode(selectedNodes[0]);
      event.preventDefault();
      return true;
    }

    if (cmdKey && event.key === 'v') {
      // Paste node
      this.pasteNode();
      event.preventDefault();
      return true;
    }

    return false;
  }

  // Update internal state when nodes change
  updateNodes(nodes: Node[]): void {
    this.nodes = nodes;
  }

  // Update configuration
  updateConfig(config: ProFeaturesConfig): void {
    this.config = config;
  }
}