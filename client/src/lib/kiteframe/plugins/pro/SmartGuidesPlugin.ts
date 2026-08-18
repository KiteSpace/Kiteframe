import type { Node, Edge, SmartGuidesConfig } from '../../types';
import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';
import { calculateSnapPosition, findAlignmentGuides, SpatialIndex, type SnapGuide, type SnapSettings, defaultSnapSettings } from '../../utils/snapUtils';

export class SmartGuidesPlugin implements KiteFramePlugin {
  name = 'smart-guides-pro';
  version = '1.0.0';
  isPro = true;

  config: SmartGuidesConfig = {};
  private currentNodes: Node[] = [];
  private currentGuides: SnapGuide[] = [];
  private spatialIndex: SpatialIndex | null = null;
  private isDragging = false;
  private draggedNodeId: string | null = null;
  private onNodesChange: ((nodes: Node[]) => void) | null = null;
  private guideUpdateCallback: ((guides: SnapGuide[]) => void) | null = null;
  
  // Performance optimization
  private frameRequest: number | null = null;
  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE = 16; // ~60fps

  initialize(core: any): void {
    // Register hooks for node operations
    const hooks: PluginHooks = {
      afterNodesChange: (nodes: Node[]) => {
        this.updateNodes(nodes);
      },
      onCanvasClick: (event: React.MouseEvent, worldPos: {x: number, y: number}) => {
        // Clear guides when canvas is clicked
        this.clearGuides();
      }
    };

    core.registerHooks(hooks);
    
    // Register events for external control
    core.on('smartGuides:setConfig', this.updateConfig.bind(this));
    core.on('smartGuides:getGuides', () => this.currentGuides);
    core.on('smartGuides:forceUpdate', this.forceUpdate.bind(this));
  }

  // Configure the plugin with smart guides settings
  configure(
    config: SmartGuidesConfig,
    nodes: Node[],
    onNodesChange: (nodes: Node[]) => void,
    guideUpdateCallback: ((guides: SnapGuide[]) => void) | null = null
  ): void {
    this.config = { ...defaultSnapSettings, ...config };
    this.currentNodes = nodes;
    this.onNodesChange = onNodesChange;
    this.guideUpdateCallback = guideUpdateCallback;
    
    // Rebuild spatial index for performance
    this.rebuildSpatialIndex();
  }

  // Update configuration when props change
  updateConfig(config: SmartGuidesConfig): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.enabled && this.currentNodes.length > 0) {
      this.rebuildSpatialIndex();
      this.updateAlignmentGuides();
    }
  }

  updateNodes(nodes: Node[]): void {
    this.currentNodes = nodes;
    this.rebuildSpatialIndex();
    
    // Update guides if we're not currently dragging
    if (!this.isDragging) {
      this.updateAlignmentGuides();
    }
  }

  private rebuildSpatialIndex(): void {
    if (this.currentNodes.length > 0) {
      this.spatialIndex = new SpatialIndex(this.currentNodes);
    }
  }

  private handleDragStart(nodeId: string, worldPos: { x: number; y: number }): void {
    if (!this.isEnabled()) return;
    
    this.isDragging = true;
    this.draggedNodeId = nodeId;
  }

  private handleDrag(nodeId: string, worldPos: { x: number; y: number }): void {
    if (!this.isEnabled() || !this.isDragging || nodeId !== this.draggedNodeId) return;
    
    // Throttle updates for performance
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_THROTTLE) return;
    
    this.lastUpdateTime = now;
    
    // Cancel previous frame request
    if (this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
    }
    
    // Schedule snap calculation on next frame
    this.frameRequest = requestAnimationFrame(() => {
      this.performSnapCalculation(nodeId, worldPos);
    });
  }

  private handleDragEnd(nodeId: string, worldPos: { x: number; y: number }): void {
    if (!this.isEnabled()) return;
    
    this.isDragging = false;
    this.draggedNodeId = null;
    
    // Clear guides
    this.currentGuides = [];
    if (this.guideUpdateCallback) {
      this.guideUpdateCallback([]);
    }
    
    // Cancel any pending frame request
    if (this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
  }

  private performSnapCalculation(nodeId: string, targetPosition: { x: number; y: number }): void {
    const draggedNode = this.currentNodes.find(n => n.id === nodeId);
    if (!draggedNode) return;
    
    const snapSettings: SnapSettings = {
      enabled: this.config.enabled === true,
      threshold: this.config.threshold || 10,
      showGuides: this.config.showGuides === true,
      snapToNodes: this.config.snapToNodes === true,
      snapToGrid: this.config.snapToGrid === true,
      gridSize: this.config.gridSize || 20,
      snapToCanvas: this.config.snapToCanvas === true
    };
    
    // Use estimated canvas size (this could be improved with actual canvas dimensions)
    const canvasSize = { width: 2000, height: 1500 };
    
    const snapResult = calculateSnapPosition(
      draggedNode,
      targetPosition,
      this.currentNodes,
      canvasSize,
      snapSettings,
      this.spatialIndex || undefined
    );
    
    // Update guides
    this.currentGuides = snapResult.guides;
    if (this.guideUpdateCallback) {
      this.guideUpdateCallback(snapResult.guides);
    }
    
    // Apply snap position if needed
    if (snapResult.snapped && this.onNodesChange) {
      const updatedNodes = this.currentNodes.map(node => 
        node.id === nodeId 
          ? { ...node, position: snapResult.position }
          : node
      );
      this.onNodesChange(updatedNodes);
    }
  }

  private updateAlignmentGuides(): void {
    if (!this.isEnabled() || this.isDragging) return;
    
    const canvasSize = { width: 2000, height: 1500 };
    const alignmentGuides = findAlignmentGuides(this.currentNodes, canvasSize);
    
    this.currentGuides = alignmentGuides;
    if (this.guideUpdateCallback) {
      this.guideUpdateCallback(alignmentGuides);
    }
  }

  private clearGuides(): void {
    this.currentGuides = [];
    if (this.guideUpdateCallback) {
      this.guideUpdateCallback([]);
    }
  }

  private forceUpdate(): void {
    this.rebuildSpatialIndex();
    this.updateAlignmentGuides();
  }

  private isEnabled(): boolean {
    return this.config.enabled === true;
  }

  // Public API for external use
  getGuides(): SnapGuide[] {
    return this.currentGuides;
  }

  isActive(): boolean {
    return this.isEnabled();
  }

  setEnabled(enabled: boolean): void {
    this.updateConfig({ enabled });
  }

  cleanup(): void {
    if (this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    this.currentGuides = [];
    this.spatialIndex = null;
  }
}