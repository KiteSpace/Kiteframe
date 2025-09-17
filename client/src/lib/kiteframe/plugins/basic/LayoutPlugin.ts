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

    // Listen for workflow-level layout events
    core.on('layout:workflows-horizontal', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.layoutWorkflows(nodes, edges, 'horizontal');
      context.updateNodes(layouted);
    });

    core.on('layout:workflows-vertical', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.layoutWorkflows(nodes, edges, 'vertical');
      context.updateNodes(layouted);
    });

    core.on('layout:workflows-grid', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.layoutWorkflows(nodes, edges, 'grid');
      context.updateNodes(layouted);
    });

    core.on('layout:workflows-circular', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.layoutWorkflows(nodes, edges, 'circular');
      context.updateNodes(layouted);
    });

    core.on('layout:workflows-hierarchical', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.layoutWorkflows(nodes, edges, 'hierarchical');
      context.updateNodes(layouted);
    });

    // Listen for node-level layout events (original behavior)
    core.on('layout:nodes-horizontal', () => {
      const nodes = context.getNodes();
      const layouted = this.horizontalFlow(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:nodes-vertical', () => {
      const nodes = context.getNodes();
      const layouted = this.verticalFlow(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:nodes-grid', () => {
      const nodes = context.getNodes();
      const layouted = this.gridLayout(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:nodes-circular', () => {
      const nodes = context.getNodes();
      const layouted = this.circularLayout(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:nodes-hierarchical', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.hierarchicalLayout(nodes, edges);
      context.updateNodes(layouted);
    });

    console.log('Layout Plugin initialized');
  }

  /**
   * Layout entire workflows as units (workflow-level layout)
   * Moves entire workflows without rearranging internal nodes
   */
  layoutWorkflows(nodes: Node[], edges: Edge[], layoutType: string): Node[] {
    // Detect separate workflows
    const flows = FlowDetection.detectFlows(nodes, edges);
    
    if (flows.length <= 1) return nodes; // Nothing to rearrange
    
    // Create workflow units with their center points
    const workflowUnits = flows.map(flow => {
      const boundingBox = this.calculateFlowBoundingBox(flow.nodes);
      return {
        flow,
        centerX: boundingBox.x + boundingBox.width / 2,
        centerY: boundingBox.y + boundingBox.height / 2,
        boundingBox
      };
    });
    
    // Calculate new positions for workflow centers based on layout type
    const layoutedCenters = this.calculateWorkflowCenterPositions(workflowUnits, layoutType);
    
    // Apply offsets to move each workflow to its new center position
    const result: Node[] = [];
    
    layoutedCenters.forEach((unit, index) => {
      const originalUnit = workflowUnits[index];
      const offsetX = unit.centerX - originalUnit.centerX;
      const offsetY = unit.centerY - originalUnit.centerY;
      
      // Apply offset to all nodes in this workflow
      const offsetNodes = unit.flow.nodes.map(node => ({
        ...node,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        }
      }));
      
      result.push(...offsetNodes);
    });
    
    return result;
  }
  
  /**
   * Calculate new center positions for workflows based on layout algorithm
   */
  private calculateWorkflowCenterPositions(
    workflowUnits: Array<{ flow: Flow; centerX: number; centerY: number; boundingBox: any }>,
    layoutType: string
  ): Array<{ flow: Flow; centerX: number; centerY: number }> {
    const WORKFLOW_SPACING = 400;
    
    switch (layoutType) {
      case 'horizontal':
        return workflowUnits.map((unit, index) => ({
          flow: unit.flow,
          centerX: index * WORKFLOW_SPACING + 300,
          centerY: unit.centerY // Keep original Y position
        }));
        
      case 'vertical':
        return workflowUnits.map((unit, index) => ({
          flow: unit.flow,
          centerX: unit.centerX, // Keep original X position
          centerY: index * WORKFLOW_SPACING + 200
        }));
        
      case 'grid': {
        const columns = Math.ceil(Math.sqrt(workflowUnits.length));
        return workflowUnits.map((unit, index) => {
          const row = Math.floor(index / columns);
          const col = index % columns;
          return {
            flow: unit.flow,
            centerX: col * WORKFLOW_SPACING + 300,
            centerY: row * WORKFLOW_SPACING + 200
          };
        });
      }
      
      case 'circular': {
        const radius = Math.max(300, workflowUnits.length * 50);
        const centerX = 500;
        const centerY = 400;
        const angleStep = (2 * Math.PI) / workflowUnits.length;
        
        return workflowUnits.map((unit, index) => {
          const angle = index * angleStep;
          return {
            flow: unit.flow,
            centerX: centerX + radius * Math.cos(angle),
            centerY: centerY + radius * Math.sin(angle)
          };
        });
      }
      
      case 'hierarchical':
        // For hierarchical, arrange workflows vertically for simplicity
        return workflowUnits.map((unit, index) => ({
          flow: unit.flow,
          centerX: unit.centerX, // Keep original X
          centerY: index * WORKFLOW_SPACING + 200
        }));
        
      default:
        return workflowUnits.map(unit => ({
          flow: unit.flow,
          centerX: unit.centerX,
          centerY: unit.centerY
        }));
    }
  }

  /**
   * Apply layout per-flow instead of globally (deprecated - kept for compatibility)
   */
  applyLayoutPerFlow(nodes: Node[], edges: Edge[], layoutType: string): Node[] {
    // Detect separate flows (connected components)
    const flows = FlowDetection.detectFlows(nodes, edges);
    
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
    
    // Position flows to avoid overlap based on layout direction
    const positionedFlows = this.positionFlowsSpatially(layoutedFlows, layoutType);
    
    // Merge all flow nodes back into single array
    const result: Node[] = [];
    positionedFlows.forEach(flow => {
      result.push(...flow.nodes);
    });
    
    return result;
  }
  
  /**
   * Position flows spatially to avoid overlap based on layout direction
   */
  private positionFlowsSpatially(flows: Flow[], layoutType: string): Flow[] {
    if (flows.length <= 1) return flows;
    
    const FLOW_SPACING = 400; // Minimum spacing between flows
    
    // Determine spacing direction based on layout type
    const useHorizontalSpacing = layoutType === 'vertical';
    
    let currentX = 0;
    let currentY = 0;
    
    return flows.map((flow, index) => {
      if (index === 0) {
        // First flow stays at its original position
        const boundingBox = this.calculateFlowBoundingBox(flow.nodes);
        if (useHorizontalSpacing) {
          currentX = boundingBox.x + boundingBox.width + FLOW_SPACING;
        } else {
          currentY = boundingBox.y + boundingBox.height + FLOW_SPACING;
        }
        return flow;
      }
      
      // Calculate current bounding box
      const boundingBox = this.calculateFlowBoundingBox(flow.nodes);
      
      // Calculate offset needed based on layout direction
      let offsetX = 0;
      let offsetY = 0;
      
      if (useHorizontalSpacing) {
        // Horizontal spacing for vertical layouts
        offsetX = currentX - boundingBox.x;
      } else {
        // Vertical spacing for horizontal layouts
        offsetY = currentY - boundingBox.y;
      }
      
      // Apply offset to all nodes in this flow
      const offsetNodes = flow.nodes.map(node => ({
        ...node,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        }
      }));
      
      // Update position for next flow
      const newBoundingBox = this.calculateFlowBoundingBox(offsetNodes);
      if (useHorizontalSpacing) {
        currentX = newBoundingBox.x + newBoundingBox.width + FLOW_SPACING;
      } else {
        currentY = newBoundingBox.y + newBoundingBox.height + FLOW_SPACING;
      }
      
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