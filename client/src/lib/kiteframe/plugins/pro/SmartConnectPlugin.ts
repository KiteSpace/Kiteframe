import type { Node, Edge, SmartConnectConfig } from '../../types';
import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';

export class SmartConnectPlugin implements KiteFramePlugin {
  name = 'smart-connect-pro';
  version = '1.0.0';
  isPro = true;

  config: SmartConnectConfig = {};
  private currentNodes: Node[] = [];
  private currentEdges: Edge[] = [];
  private onConnect: ((connection: { source: string; target: string }) => void) | null = null;
  private onEdgesChange: ((edges: Edge[]) => void) | null = null;
  private isDragging = false;
  private draggedNodeId: string | null = null;
  private previewConnection: { source: string; target: string } | null = null;
  private connectionPreviewCallback: ((preview: { source: string; target: string } | null) => void) | null = null;
  
  // Performance optimization
  private frameRequest: number | null = null;
  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE = 16; // ~60fps
  private dragOffset: { dx: number; dy: number } | null = null;
  
  // Drag distance tracking to distinguish clicks from actual drags
  private dragStartPos: { x: number; y: number } | null = null;
  private readonly DRAG_THRESHOLD = 10; // pixels - minimum drag distance to trigger auto-connect
  
  // Position tracking to only trigger auto-connect when nodes actually move
  private previousNodePositions: Map<string, { x: number; y: number }> = new Map();

  initialize(core: any): void {
    // Register hooks for connection operations
    const hooks: PluginHooks = {
      onConnectionAttempt: (source: string, target: string) => {
        return this.validateConnection(source, target);
      },
      afterNodesChange: (nodes: Node[]) => {
        this.updateNodes(nodes);
      },
      afterEdgesChange: (edges: Edge[]) => {
        this.updateEdges(edges);
      }
    };

    core.registerHooks(hooks);
    
    // Register events for external control
    core.on('smartConnect:setConfig', this.updateConfig.bind(this));
    core.on('smartConnect:getPreview', () => this.previewConnection);
    core.on('smartConnect:forceCheck', this.checkAutoConnections.bind(this));
  }

  // Configure the plugin with smart connect settings
  configure(
    config: SmartConnectConfig,
    nodes: Node[],
    edges: Edge[],
    onConnect: (connection: { source: string; target: string }) => void,
    onEdgesChange: (edges: Edge[]) => void,
    connectionPreviewCallback?: (preview: { source: string; target: string } | null) => void
  ): void {
    this.config = { 
      enabled: true,
      threshold: 25,
      showPreview: true,
      autoConnect: false,
      ...config 
    };
    this.currentNodes = nodes;
    this.currentEdges = edges;
    this.onConnect = onConnect;
    this.onEdgesChange = onEdgesChange;
    this.connectionPreviewCallback = connectionPreviewCallback || null;
  }

  // Update configuration when props change
  updateConfig(config: SmartConnectConfig): void {
    this.config = { ...this.config, ...config };
  }

  updateNodes(nodes: Node[]): void {
    this.currentNodes = nodes;
    
    // Check for auto-connections only if nodes actually moved (not just selection changes)
    if (this.config.autoConnect && !this.isDragging) {
      const hasPositionChanges = this.hasNodePositionChanges(nodes);
      if (hasPositionChanges) {
        this.checkAutoConnections();
      }
    }
    
    // Update stored positions for next comparison
    this.updateStoredPositions(nodes);
  }

  updateEdges(edges: Edge[]): void {
    this.currentEdges = edges;
  }

  private handleDragStart(nodeId: string, worldPos: { x: number; y: number }): void {
    if (!this.isEnabled()) return;
    
    this.isDragging = true;
    this.draggedNodeId = nodeId;
    this.dragStartPos = { x: worldPos.x, y: worldPos.y };
    
    // Calculate drag offset to convert worldPos to node top-left position
    const draggedNode = this.currentNodes.find(n => n.id === nodeId);
    if (draggedNode) {
      this.dragOffset = {
        dx: worldPos.x - draggedNode.position.x,
        dy: worldPos.y - draggedNode.position.y
      };
    }
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
    
    // Schedule proximity check on next frame
    this.frameRequest = requestAnimationFrame(() => {
      this.checkProximityConnections(nodeId, worldPos);
    });
  }

  private handleDragEnd(nodeId: string, worldPos: { x: number; y: number }): void {
    if (!this.isEnabled()) return;
    
    this.isDragging = false;
    
    // Calculate drag distance to determine if this was a real drag or just a click
    let wasActualDrag = false;
    if (this.dragStartPos) {
      const dragDistance = Math.sqrt(
        Math.pow(worldPos.x - this.dragStartPos.x, 2) + 
        Math.pow(worldPos.y - this.dragStartPos.y, 2)
      );
      wasActualDrag = dragDistance >= this.DRAG_THRESHOLD;
    }
    
    // Clear preview first
    this.clearPreview();
    this.draggedNodeId = null;
    this.dragOffset = null;
    this.dragStartPos = null;
    
    // Cancel any pending frame request
    if (this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    
    // Only perform auto-connection check if this was an actual drag, not just a click
    if (this.config.autoConnect && wasActualDrag) {
      this.checkAutoConnections();
    }
  }
  
  private hasNodePositionChanges(nodes: Node[]): boolean {
    for (const node of nodes) {
      const prevPos = this.previousNodePositions.get(node.id);
      if (!prevPos) {
        // New node, consider this a position change
        continue;
      }
      
      const deltaX = Math.abs(node.position.x - prevPos.x);
      const deltaY = Math.abs(node.position.y - prevPos.y);
      
      // If any node moved more than 1 pixel, consider it a position change
      if (deltaX > 1 || deltaY > 1) {
        return true;
      }
    }
    return false;
  }
  
  private updateStoredPositions(nodes: Node[]): void {
    this.previousNodePositions.clear();
    for (const node of nodes) {
      this.previousNodePositions.set(node.id, { x: node.position.x, y: node.position.y });
    }
  }

  private checkProximityConnections(nodeId: string, nodePosition: { x: number; y: number }): void {
    const draggedNode = this.currentNodes.find(n => n.id === nodeId);
    if (!draggedNode) return;
    
    // Convert worldPos to node top-left position using drag offset
    let correctedPosition = nodePosition;
    if (this.dragOffset) {
      correctedPosition = {
        x: nodePosition.x - this.dragOffset.dx,
        y: nodePosition.y - this.dragOffset.dy
      };
    }
    
    const threshold = this.config.threshold || 25;
    let closestTarget: string | null = null;
    let closestDistance = Infinity;
    
    // Create a temporary node with updated position for accurate calculation
    const updatedDraggedNode = { ...draggedNode, position: correctedPosition };
    
    // Check proximity to other nodes (optimized to skip already connected nodes)
    for (const targetNode of this.currentNodes) {
      if (targetNode.id === nodeId) continue; // Skip self
      
      // Performance optimization: Skip nodes already connected to dragged node
      if (this.connectionExists(nodeId, targetNode.id)) continue;
      
      // Calculate distance from nearest edges instead of centers
      const distance = this.calculateNearestEdgeDistance(correctedPosition, updatedDraggedNode, targetNode);
      
      if (distance <= threshold && distance < closestDistance) {
        closestTarget = targetNode.id;
        closestDistance = distance;
      }
    }
    
    // Update preview
    if (closestTarget !== null) {
      const newPreview = { source: nodeId, target: closestTarget };
      if (!this.previewConnection || 
          this.previewConnection.source !== newPreview.source || 
          this.previewConnection.target !== newPreview.target) {
        this.previewConnection = newPreview;
        this.updatePreview(newPreview);
      }
    } else {
      if (this.previewConnection) {
        this.clearPreview();
      }
    }
  }

  private checkAutoConnections(): void {
    if (!this.config.autoConnect || this.isDragging) return;
    
    const threshold = this.config.threshold || 25;
    const newConnections: { source: string; target: string }[] = [];
    
    this.currentNodes.forEach(sourceNode => {
      this.currentNodes.forEach(targetNode => {
        if (sourceNode.id === targetNode.id) return; // Avoid self-connections
        if (this.connectionExists(sourceNode.id, targetNode.id)) return; // Skip existing connections
        
        // Calculate distance from nearest edges instead of centers
        const distance = this.calculateNearestEdgeDistance(sourceNode.position, sourceNode, targetNode);
        
        if (distance <= threshold) {
          newConnections.push({ source: sourceNode.id, target: targetNode.id });
        }
      });
    });
    
    // Execute auto-connections
    newConnections.forEach(connection => {
      this.executeAutoConnection(connection);
    });
  }

  private executeAutoConnection(connection: { source: string; target: string }): void {
    if (this.onConnect && this.validateConnection(connection.source, connection.target)) {
      this.onConnect(connection);
    }
  }

  private connectionExists(sourceId: string, targetId: string): boolean {
    return this.currentEdges.some(edge => 
      (edge.source === sourceId && edge.target === targetId) ||
      (edge.source === targetId && edge.target === sourceId)
    );
  }

  private calculateNearestEdgeDistance(
    sourcePos: { x: number; y: number }, 
    sourceNode: any, 
    targetNode: any
  ): number {
    const sourceWidth = sourceNode.width || 200;
    const sourceHeight = sourceNode.height || 100;
    const targetWidth = targetNode.width || 200;
    const targetHeight = targetNode.height || 100;
    
    // Calculate bounding boxes
    const sourceRect = {
      left: sourcePos.x,
      right: sourcePos.x + sourceWidth,
      top: sourcePos.y,
      bottom: sourcePos.y + sourceHeight
    };
    
    const targetRect = {
      left: targetNode.position.x,
      right: targetNode.position.x + targetWidth,
      top: targetNode.position.y,
      bottom: targetNode.position.y + targetHeight
    };
    
    // Calculate minimum distance between rectangles
    let dx = 0;
    let dy = 0;
    
    if (sourceRect.right < targetRect.left) {
      dx = targetRect.left - sourceRect.right;
    } else if (sourceRect.left > targetRect.right) {
      dx = sourceRect.left - targetRect.right;
    }
    
    if (sourceRect.bottom < targetRect.top) {
      dy = targetRect.top - sourceRect.bottom;
    } else if (sourceRect.top > targetRect.bottom) {
      dy = sourceRect.top - targetRect.bottom;
    }
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  private validateConnection(sourceId: string, targetId: string): boolean {
    // Basic validation - prevent self-connections and duplicates
    if (sourceId === targetId) return false;
    if (this.connectionExists(sourceId, targetId)) return false;
    
    // Allow other plugins or custom logic to validate
    return true;
  }

  private updatePreview(preview: { source: string; target: string }): void {
    if (this.config.showPreview && this.connectionPreviewCallback) {
      this.connectionPreviewCallback(preview);
    }
  }

  private clearPreview(): void {
    this.previewConnection = null;
    if (this.connectionPreviewCallback) {
      this.connectionPreviewCallback(null);
    }
  }

  private isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  // Public API for external use
  getPreviewConnection(): { source: string; target: string } | null {
    return this.previewConnection;
  }

  isActive(): boolean {
    return this.isEnabled();
  }

  setEnabled(enabled: boolean): void {
    this.updateConfig({ enabled });
  }

  setThreshold(threshold: number): void {
    this.updateConfig({ threshold });
  }

  forceConnectionCheck(): void {
    this.checkAutoConnections();
  }

  cleanup(): void {
    if (this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    this.clearPreview();
  }
}

// Export plugin instance for registration
export const smartConnectPlugin = new SmartConnectPlugin();