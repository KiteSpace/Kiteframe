import type { Node, Edge, ProFeaturesConfig, NodeType, SmartGuidesConfig, SmartConnectConfig } from '../../types';
import { calculateSnapPosition, findAlignmentGuides, SpatialIndex, type SnapGuide, type SnapSettings, defaultSnapSettings } from '../../utils/snapUtils';

/**
 * ProFeaturesManager - Centralized manager for all premium features
 * This class provides a clean API for managing pro feature functionality
 * without global DOM manipulation or event listeners.
 */
export class ProFeaturesManager {
  private config: ProFeaturesConfig;
  private nodes: Node[];
  private edges: Edge[] = [];
  private onNodesChange: (nodes: Node[]) => void;
  private onEdgesChange?: (edges: Edge[]) => void;
  private onConnect?: (connection: { source: string; target: string }) => void;
  
  // Smart Guides state
  private spatialIndex: SpatialIndex | null = null;
  private currentGuides: SnapGuide[] = [];
  private guideUpdateCallback: ((guides: SnapGuide[]) => void) | null = null;
  private canvasSize = { width: 2000, height: 1500 };
  
  // Smart Connect state
  private connectionPreviewCallback: ((preview: { source: string; target: string } | null) => void) | null = null;
  private previewConnection: { source: string; target: string } | null = null;

  constructor(
    config: ProFeaturesConfig,
    nodes: Node[],
    edges: Edge[],
    onNodesChange: (nodes: Node[]) => void,
    onEdgesChange?: (edges: Edge[]) => void,
    onConnect?: (connection: { source: string; target: string }) => void
  ) {
    this.config = config;
    this.nodes = nodes;
    this.edges = edges;
    this.onNodesChange = onNodesChange;
    this.onEdgesChange = onEdgesChange;
    this.onConnect = onConnect;
    
    // Initialize smart guides spatial index
    this.rebuildSpatialIndex();
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

  // Smart Guides Feature
  isSmartGuidesEnabled(): boolean {
    return this.config.smartGuides?.enabled !== false;
  }

  setGuideUpdateCallback(callback: (guides: SnapGuide[]) => void): void {
    this.guideUpdateCallback = callback;
  }

  setCanvasSize(size: { width: number; height: number }): void {
    this.canvasSize = size;
  }

  private rebuildSpatialIndex(): void {
    if (this.nodes.length > 0) {
      this.spatialIndex = new SpatialIndex(this.nodes);
    }
  }

  handleDragWithSmartGuides(
    nodeId: string, 
    targetPosition: { x: number; y: number }
  ): { position: { x: number; y: number }; guides: SnapGuide[] } {
    if (!this.isSmartGuidesEnabled()) {
      return { position: targetPosition, guides: [] };
    }

    const draggedNode = this.nodes.find(n => n.id === nodeId);
    if (!draggedNode) {
      return { position: targetPosition, guides: [] };
    }

    const snapSettings: SnapSettings = {
      enabled: this.config.smartGuides?.enabled !== false,
      threshold: this.config.smartGuides?.threshold || 10,
      showGuides: this.config.smartGuides?.showGuides !== false,
      snapToNodes: this.config.smartGuides?.snapToNodes !== false,
      snapToGrid: this.config.smartGuides?.snapToGrid === true,
      gridSize: this.config.smartGuides?.gridSize || 20,
      snapToCanvas: this.config.smartGuides?.snapToCanvas !== false
    };

    const snapResult = calculateSnapPosition(
      draggedNode,
      targetPosition,
      this.nodes,
      this.canvasSize,
      snapSettings,
      this.spatialIndex || undefined
    );

    // Update guides
    this.currentGuides = snapResult.guides;
    if (this.guideUpdateCallback) {
      this.guideUpdateCallback(snapResult.guides);
    }

    return { position: snapResult.position, guides: snapResult.guides };
  }

  clearGuides(): void {
    this.currentGuides = [];
    if (this.guideUpdateCallback) {
      this.guideUpdateCallback([]);
    }
  }

  getAlignmentGuides(): SnapGuide[] {
    if (!this.isSmartGuidesEnabled()) return [];
    return findAlignmentGuides(this.nodes, this.canvasSize);
  }

  // Smart Connect Feature
  isSmartConnectEnabled(): boolean {
    return this.config.smartConnect?.enabled !== false;
  }

  setConnectionPreviewCallback(callback: (preview: { source: string; target: string } | null) => void): void {
    this.connectionPreviewCallback = callback;
  }

  checkAutoConnection(nodeId: string, targetPosition: { x: number; y: number }): void {
    if (!this.isSmartConnectEnabled()) return;

    const threshold = this.config.smartConnect?.threshold || 50;
    const draggedNode = this.nodes.find(n => n.id === nodeId);
    if (!draggedNode) return;

    let closestConnection: { target: string; distance: number } | null = null;

    // Check proximity to other nodes
    this.nodes.forEach(targetNode => {
      if (targetNode.id === nodeId) return; // Skip self
      
      // Check if connection already exists
      if (this.connectionExists(nodeId, targetNode.id)) return;
      
      // Calculate distance between node centers
      const targetWidth = targetNode.width || 200;
      const targetHeight = targetNode.height || 100;
      const nodeWidth = draggedNode.width || 200;
      const nodeHeight = draggedNode.height || 100;
      
      const targetCenterX = targetNode.position.x + targetWidth / 2;
      const targetCenterY = targetNode.position.y + targetHeight / 2;
      const nodeCenterX = targetPosition.x + nodeWidth / 2;
      const nodeCenterY = targetPosition.y + nodeHeight / 2;
      
      const distance = Math.sqrt(
        Math.pow(targetCenterX - nodeCenterX, 2) + 
        Math.pow(targetCenterY - nodeCenterY, 2)
      );
      
      if (distance <= threshold) {
        if (!closestConnection || distance < closestConnection.distance) {
          closestConnection = { target: targetNode.id, distance };
        }
      }
    });

    // Update preview
    if (closestConnection) {
      const newPreview = { source: nodeId, target: closestConnection.target };
      this.previewConnection = newPreview;
      if (this.connectionPreviewCallback) {
        this.connectionPreviewCallback(newPreview);
      }
    } else {
      this.clearConnectionPreview();
    }
  }

  executeAutoConnection(): void {
    if (this.config.smartConnect?.autoConnect && this.previewConnection && this.onConnect) {
      this.onConnect(this.previewConnection);
      console.log('🔗 SmartConnect: Auto-connected', this.previewConnection.source, '→', this.previewConnection.target);
    }
    this.clearConnectionPreview();
  }

  private connectionExists(sourceId: string, targetId: string): boolean {
    return this.edges.some(edge => 
      (edge.source === sourceId && edge.target === targetId) ||
      (edge.source === targetId && edge.target === sourceId)
    );
  }

  clearConnectionPreview(): void {
    this.previewConnection = null;
    if (this.connectionPreviewCallback) {
      this.connectionPreviewCallback(null);
    }
  }

  // Update internal state when nodes change
  updateNodes(nodes: Node[]): void {
    this.nodes = nodes;
    this.rebuildSpatialIndex();
    
    // Update alignment guides if not dragging
    if (this.isSmartGuidesEnabled() && this.currentGuides.length === 0) {
      const alignmentGuides = this.getAlignmentGuides();
      this.currentGuides = alignmentGuides;
      if (this.guideUpdateCallback) {
        this.guideUpdateCallback(alignmentGuides);
      }
    }
  }

  // Update edges state
  updateEdges(edges: Edge[]): void {
    this.edges = edges;
  }

  // Update configuration
  updateConfig(config: ProFeaturesConfig): void {
    this.config = config;
  }
}