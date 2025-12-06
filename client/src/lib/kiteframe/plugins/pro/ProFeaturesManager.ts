import type { Node, Edge, CanvasObject, ProFeaturesConfig, NodeType, SmartGuidesConfig, SmartConnectConfig } from '../../types';
import { calculateSnapPosition, findAlignmentGuides, SpatialIndex, type SnapGuide, type SnapSettings, defaultSnapSettings } from '../../utils/snapUtils';
import { clipboardManager } from '../../utils/ClipboardManager';

/**
 * ProFeaturesManager - Centralized manager for all premium features
 * This class provides a clean API for managing pro feature functionality
 * without global DOM manipulation or event listeners.
 */
export class ProFeaturesManager {
  private config: ProFeaturesConfig;
  private nodes: Node[];
  private edges: Edge[] = [];
  private canvasObjects: CanvasObject[] = [];
  private onNodesChange: (nodes: Node[]) => void;
  private onEdgesChange?: (edges: Edge[]) => void;
  private onCanvasObjectsChange?: (canvasObjects: CanvasObject[]) => void;
  private onConnect?: (connection: { source: string; target: string }) => void;
  
  // Viewport state for centered paste
  private viewportState: { x: number; y: number; zoom: number } | null = null;
  private containerDimensions: { width: number; height: number } | null = null;
  
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
    onConnect?: (connection: { source: string; target: string }) => void,
    canvasObjects: CanvasObject[] = [],
    onCanvasObjectsChange?: (canvasObjects: CanvasObject[]) => void
  ) {
    this.config = config;
    this.nodes = nodes;
    this.edges = edges;
    this.canvasObjects = canvasObjects;
    this.onNodesChange = onNodesChange;
    this.onEdgesChange = onEdgesChange;
    this.onCanvasObjectsChange = onCanvasObjectsChange;
    this.onConnect = onConnect;
    
    // Initialize smart guides spatial index
    this.rebuildSpatialIndex();
  }

  // Viewport management for centered paste
  setViewportInfo(viewport: { x: number; y: number; zoom: number }, containerDimensions: { width: number; height: number }): void {
    this.viewportState = viewport;
    this.containerDimensions = containerDimensions;
  }

  /**
   * Calculate the center of the current viewport in world coordinates
   * This is where pasted items will be positioned
   */
  private calculateViewportCenter(): { x: number; y: number } | null {
    if (!this.viewportState || !this.containerDimensions) {
      return null;
    }

    const { x: viewX, y: viewY, zoom } = this.viewportState;
    const { width: containerWidth, height: containerHeight } = this.containerDimensions;

    // Convert the center of the screen to world coordinates
    // Screen center coordinates
    const screenCenterX = containerWidth / 2;
    const screenCenterY = containerHeight / 2;

    // Convert screen coordinates to world coordinates
    // This is the inverse of the viewport transform: translate(viewX, viewY) scale(zoom)
    const worldCenterX = (screenCenterX - viewX) / zoom;
    const worldCenterY = (screenCenterY - viewY) / zoom;

    return { x: worldCenterX, y: worldCenterY };
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

  // Copy/Paste Feature - Unified for nodes and canvas objects
  isCopyPasteEnabled(): boolean {
    return this.config.copyPaste?.enabled !== false;
  }

  copySelected(): boolean {
    if (!this.isCopyPasteEnabled()) return false;

    const selectedNodes = this.nodes.filter(node => node.selected === true);
    const selectedCanvasObjects = this.canvasObjects.filter(obj => obj.selected === true);
    
    if (selectedNodes.length === 0 && selectedCanvasObjects.length === 0) {
      return false;
    }

    const success = clipboardManager.copy(selectedNodes, selectedCanvasObjects);
    
    // Call custom handler if provided
    if (success && this.config.copyPaste?.onCopy) {
      // Call for each copied node (backward compatibility)
      selectedNodes.forEach(node => this.config.copyPaste?.onCopy?.(node));
    }

    return success;
  }

  pasteFromClipboard(): { 
    newNodes: Node[];
    newCanvasObjects: CanvasObject[];
    success: boolean;
  } {
    if (!this.isCopyPasteEnabled()) {
      return { newNodes: [], newCanvasObjects: [], success: false };
    }

    if (!clipboardManager.hasData()) {
      return { newNodes: [], newCanvasObjects: [], success: false };
    }

    // Calculate viewport center for paste position
    const viewportCenter = this.calculateViewportCenter();
    
    const result = clipboardManager.paste(
      this.nodes,
      this.canvasObjects,
      viewportCenter || undefined, // Use viewport center if available, fallback to default behavior
      { offsetDistance: this.config.copyPaste?.offsetDistance ?? 50 }
    );

    if (result.nodes.length > 0 || result.canvasObjects.length > 0) {
      // Update nodes
      if (result.nodes.length > 0) {
        const updatedNodes = [...this.nodes, ...result.nodes];
        this.onNodesChange(updatedNodes);
      }

      // Update canvas objects
      if (result.canvasObjects.length > 0 && this.onCanvasObjectsChange) {
        const updatedCanvasObjects = [...this.canvasObjects, ...result.canvasObjects];
        this.onCanvasObjectsChange(updatedCanvasObjects);
      }

      // Call custom handlers if provided
      if (this.config.copyPaste?.onPaste) {
        result.nodes.forEach(newNode => {
          // Find original node for backward compatibility
          const originalData = clipboardManager.getClipboardSummary();
          if (originalData.nodeCount > 0) {
            this.config.copyPaste?.onPaste?.(newNode, newNode); // Use same node as both args for compatibility
          }
        });
      }

      return { 
        newNodes: result.nodes, 
        newCanvasObjects: result.canvasObjects, 
        success: true 
      };
    }

    return { newNodes: [], newCanvasObjects: [], success: false };
  }

  // Legacy methods for backward compatibility
  copyNode(node: Node): void {
    if (!this.isCopyPasteEnabled()) return;
    
    clipboardManager.copy([node], []);
    
    if (this.config.copyPaste?.onCopy) {
      this.config.copyPaste.onCopy(node);
    }
  }

  pasteNode(): Node | null {
    const result = this.pasteFromClipboard();
    return result.newNodes.length > 0 ? result.newNodes[0] : null;
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

  // Keyboard shortcuts handler - Updated for unified copy-paste
  handleKeyboardShortcut(event: KeyboardEvent, selectedNodes: Node[], selectedCanvasObjects: CanvasObject[] = []): boolean {
    if (!this.isCopyPasteEnabled()) return false;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? event.metaKey : event.ctrlKey;

    if (cmdKey && event.key === 'c') {
      // Copy selected items (nodes and/or canvas objects)
      const hasSelection = selectedNodes.length > 0 || selectedCanvasObjects.length > 0;
      if (hasSelection) {
        const success = clipboardManager.copy(selectedNodes, selectedCanvasObjects);
        if (success) {
          event.preventDefault();
          return true;
        }
      }
    }

    if (cmdKey && event.key === 'v') {
      // Paste items
      if (clipboardManager.hasData()) {
        const result = this.pasteFromClipboard();
        if (result.success) {
          event.preventDefault();
          return true;
        }
      }
    }

    return false;
  }

  // Smart Guides Feature
  isSmartGuidesEnabled(): boolean {
    return this.config.smartGuides?.enabled === true;
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
      enabled: this.config.smartGuides?.enabled === true,
      threshold: this.config.smartGuides?.threshold || 10,
      showGuides: this.config.smartGuides?.showGuides === true,
      snapToNodes: this.config.smartGuides?.snapToNodes === true,
      snapToGrid: this.config.smartGuides?.snapToGrid === true,
      gridSize: this.config.smartGuides?.gridSize || 20,
      snapToCanvas: this.config.smartGuides?.snapToCanvas === true
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

    let closestTarget: string | null = null;
    let closestDistance = Infinity;

    // Check proximity to other nodes
    for (const targetNode of this.nodes) {
      if (targetNode.id === nodeId) continue; // Skip self
      
      // Check if connection already exists
      if (this.connectionExists(nodeId, targetNode.id)) continue;
      
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
      
      if (distance <= threshold && distance < closestDistance) {
        closestTarget = targetNode.id;
        closestDistance = distance;
      }
    }

    // Update preview
    if (closestTarget !== null) {
      const newPreview = { source: nodeId, target: closestTarget };
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

  // Update canvas objects state
  updateCanvasObjects(canvasObjects: CanvasObject[]): void {
    this.canvasObjects = canvasObjects;
  }

  // Update configuration
  updateConfig(config: ProFeaturesConfig): void {
    this.config = config;
  }

  // Get selected canvas objects
  getSelectedCanvasObjects(): CanvasObject[] {
    return this.canvasObjects.filter(obj => obj.selected === true);
  }

  // Check if clipboard has data
  hasClipboardData(): boolean {
    return clipboardManager.hasData();
  }

  // Get clipboard summary
  getClipboardSummary() {
    return clipboardManager.getClipboardSummary();
  }
}