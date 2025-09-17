import type { KiteFramePlugin } from '../../core/KiteFrameCore';
import type { Node, Edge } from '../../types';
import { FlowDetection, type Flow } from '../../utils/FlowDetection';

/**
 * Layout Plugin
 * Provides automatic layout algorithms for node positioning
 */
export class LayoutPlugin implements KiteFramePlugin {
  name = 'layout';
  version = '1.0.0';

  initialize(core: any): void {
    const context = core.getContext();

    // Add layout methods to core
    core.layout = {
      horizontalFlow: this.horizontalFlow.bind(this),
      verticalFlow: this.verticalFlow.bind(this),
      grid: this.gridLayout.bind(this),
      circular: this.circularLayout.bind(this),
      hierarchical: this.hierarchicalLayout.bind(this)
    };

    // Listen for layout events - now with per-flow support
    core.on('layout:horizontal', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.applyLayoutPerFlow(nodes, edges, 'horizontal');
      context.updateNodes(layouted);
    });

    core.on('layout:vertical', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.applyLayoutPerFlow(nodes, edges, 'vertical');
      context.updateNodes(layouted);
    });

    core.on('layout:grid', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.applyLayoutPerFlow(nodes, edges, 'grid');
      context.updateNodes(layouted);
    });

    core.on('layout:circular', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.applyLayoutPerFlow(nodes, edges, 'circular');
      context.updateNodes(layouted);
    });

    core.on('layout:hierarchical', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.applyLayoutPerFlow(nodes, edges, 'hierarchical');
      context.updateNodes(layouted);
    });

    console.log('Layout Plugin initialized');
  }

  /**
   * Apply layout per-flow instead of globally
   */
  applyLayoutPerFlow(nodes: Node[], edges: Edge[], layoutType: string): Node[] {
    // Detect separate flows (connected components)
    let flows = FlowDetection.detectFlows(nodes, edges);
    flows = FlowDetection.hydrateFlows(flows, nodes);
    
    if (flows.length === 0) return nodes;
    
    // Apply layout to each flow independently
    const layoutedFlows: Flow[] = flows.map(flow => {
      let layoutedNodes: Node[];
      
      switch (layoutType) {
        case 'horizontal':
          layoutedNodes = this.horizontalFlow(flow.nodes);
          break;
        case 'vertical':
          layoutedNodes = this.verticalFlow(flow.nodes);
          break;
        case 'grid':
          layoutedNodes = this.gridLayout(flow.nodes);
          break;
        case 'circular':
          layoutedNodes = this.circularLayout(flow.nodes);
          break;
        case 'hierarchical':
          layoutedNodes = this.hierarchicalLayout(flow.nodes, flow.edges);
          break;
        default:
          layoutedNodes = flow.nodes;
      }
      
      return {
        ...flow,
        nodes: layoutedNodes
      };
    });
    
    // Position flows to avoid overlap
    const positionedFlows = this.positionFlowsSpatially(layoutedFlows);
    
    // Merge all flow nodes back into single array
    const result: Node[] = [];
    positionedFlows.forEach(flow => {
      result.push(...flow.nodes);
    });
    
    return result;
  }
  
  /**
   * Position flows spatially to avoid overlap
   */
  private positionFlowsSpatially(flows: Flow[]): Flow[] {
    if (flows.length <= 1) return flows;
    
    const FLOW_SPACING = 400; // Minimum spacing between flows
    let currentY = 0;
    
    return flows.map((flow, index) => {
      if (index === 0) {
        // First flow stays at its original position
        const boundingBox = this.calculateFlowBoundingBox(flow.nodes);
        currentY = boundingBox.y + boundingBox.height + FLOW_SPACING;
        return flow;
      }
      
      // Calculate current bounding box
      const boundingBox = this.calculateFlowBoundingBox(flow.nodes);
      
      // Calculate offset needed to move flow to new position
      const offsetY = currentY - boundingBox.y;
      
      // Apply offset to all nodes in this flow
      const offsetNodes = flow.nodes.map(node => ({
        ...node,
        position: {
          x: node.position.x,
          y: node.position.y + offsetY
        }
      }));
      
      // Update currentY for next flow
      const newBoundingBox = this.calculateFlowBoundingBox(offsetNodes);
      currentY = newBoundingBox.y + newBoundingBox.height + FLOW_SPACING;
      
      return {
        ...flow,
        nodes: offsetNodes
      };
    });
  }
  
  /**
   * Calculate bounding box for a flow's nodes
   */
  private calculateFlowBoundingBox(nodes: Node[]): {
    x: number; y: number; width: number; height: number;
  } {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    nodes.forEach(node => {
      const nodeWidth = node.style?.width ?? node.width ?? 200;
      const nodeHeight = node.style?.height ?? node.height ?? 100;
      
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Arrange nodes in horizontal flow
   */
  horizontalFlow(nodes: Node[], spacing = 250): Node[] {
    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: index * spacing + 100,
        y: node.position.y
      }
    }));
  }

  /**
   * Arrange nodes in vertical flow
   */
  verticalFlow(nodes: Node[], spacing = 150): Node[] {
    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: node.position.x,
        y: index * spacing + 100
      }
    }));
  }

  /**
   * Arrange nodes in grid layout
   */
  gridLayout(nodes: Node[], columns = 3, spacing = 250): Node[] {
    return nodes.map((node, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        ...node,
        position: {
          x: col * spacing + 100,
          y: row * spacing + 100
        }
      };
    });
  }

  /**
   * Arrange nodes in circular layout
   */
  circularLayout(nodes: Node[], radius = 300): Node[] {
    const centerX = 400;
    const centerY = 300;
    const angleStep = (2 * Math.PI) / nodes.length;

    return nodes.map((node, index) => {
      const angle = index * angleStep;
      return {
        ...node,
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        }
      };
    });
  }

  /**
   * Arrange nodes in hierarchical layout based on connections
   */
  hierarchicalLayout(nodes: Node[], edges: any[] = []): Node[] {
    // Simple hierarchical layout - can be enhanced with proper graph algorithms
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    // Calculate degrees
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      outDegree.set(node.id, 0);
    });

    edges.forEach(edge => {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    });

    // Find root nodes (no incoming edges)
    const roots = nodes.filter(node => inDegree.get(node.id) === 0);
    const levels: string[][] = [];
    const visited = new Set<string>();

    // BFS to determine levels
    let currentLevel = roots.map(n => n.id);
    while (currentLevel.length > 0) {
      levels.push([...currentLevel]);
      const nextLevel: string[] = [];

      currentLevel.forEach(nodeId => {
        visited.add(nodeId);
        edges.forEach(edge => {
          if (edge.source === nodeId && !visited.has(edge.target)) {
            // Check if all parents of target are visited
            const targetInEdges = edges.filter(e => e.target === edge.target);
            const allParentsVisited = targetInEdges.every(e => visited.has(e.source));
            
            if (allParentsVisited && !nextLevel.includes(edge.target)) {
              nextLevel.push(edge.target);
            }
          }
        });
      });

      currentLevel = nextLevel;
    }

    // Position nodes by level
    return nodes.map(node => {
      const levelIndex = levels.findIndex(level => level.includes(node.id));
      const positionInLevel = levels[levelIndex]?.indexOf(node.id) || 0;
      const levelWidth = levels[levelIndex]?.length || 1;
      const levelSpacing = 300;
      const nodeSpacing = 250;

      return {
        ...node,
        position: {
          x: positionInLevel * nodeSpacing + (800 - (levelWidth - 1) * nodeSpacing / 2),
          y: levelIndex * levelSpacing + 100
        }
      };
    });
  }

  cleanup(): void {
    // Cleanup if needed
  }
}

// Plugin instance for easy import
export const layoutPlugin = new LayoutPlugin();