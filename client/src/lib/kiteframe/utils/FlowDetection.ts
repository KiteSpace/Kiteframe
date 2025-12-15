import { Node, Edge } from '../types';

export interface FlowSettings {
  name: string;
  statusTrackingEnabled: boolean;
}

export interface Flow {
  id: string;
  nodes: Node[];
  edges: Edge[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type FlowSettingsMap = Record<string, FlowSettings>;

/**
 * Detects connected components (separate workflows) within a set of nodes and edges
 * using Depth-First Search algorithm
 */
export class FlowDetection {
  /**
   * Find all separate flows (connected components) in the graph
   */
  static detectFlows(nodes: Node[], edges: Edge[]): Flow[] {
    if (nodes.length === 0) return [];

    const visited = new Set<string>();
    const flows: Flow[] = [];
    
    // Build adjacency list for efficient traversal
    const adjacencyList = this.buildAdjacencyList(nodes, edges);
    
    // Find all connected components using DFS
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const flowNodeIds = this.dfsTraversal(node.id, adjacencyList, visited);
        // Get actual node objects for this flow
        const flowNodes = flowNodeIds.map(stubNode => 
          nodes.find(n => n.id === stubNode.id)!
        );
        const flowEdges = this.getFlowEdges(flowNodes, edges);
        const boundingBox = this.calculateBoundingBox(flowNodes);
        
        // Use stable ID based on root node (topmost-left node by position sum)
        // This ensures PRD associations persist even when canvas is modified
        let rootNodeId = flowNodes[0]?.id || `flow-${flows.length + 1}`;
        let minSum = Infinity;
        flowNodes.forEach(n => {
          const sum = (n.position?.x || 0) + (n.position?.y || 0);
          if (sum < minSum) {
            minSum = sum;
            rootNodeId = n.id;
          }
        });
        const flowId = `workflow-${rootNodeId}`;
        
        flows.push({
          id: flowId,
          nodes: flowNodes,
          edges: flowEdges,
          boundingBox
        });
      }
    }
    
    return flows;
  }
  
  /**
   * Build adjacency list representation of the graph
   */
  private static buildAdjacencyList(nodes: Node[], edges: Edge[]): Map<string, Set<string>> {
    const adjacencyList = new Map<string, Set<string>>();
    
    // Initialize adjacency list for all nodes
    nodes.forEach(node => {
      adjacencyList.set(node.id, new Set<string>());
    });
    
    // Add connections from edges
    edges.forEach(edge => {
      const sourceConnections = adjacencyList.get(edge.source);
      const targetConnections = adjacencyList.get(edge.target);
      
      if (sourceConnections && targetConnections) {
        sourceConnections.add(edge.target);
        targetConnections.add(edge.source);
      }
    });
    
    return adjacencyList;
  }
  
  /**
   * Perform DFS traversal to find all connected nodes
   */
  private static dfsTraversal(
    startNodeId: string, 
    adjacencyList: Map<string, Set<string>>, 
    visited: Set<string>
  ): Node[] {
    const stack = [startNodeId];
    const connectedNodeIds = new Set<string>();
    
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (visited.has(currentId)) continue;
      
      visited.add(currentId);
      connectedNodeIds.add(currentId);
      
      // Add all unvisited neighbors to stack
      const neighbors = adjacencyList.get(currentId);
      if (neighbors) {
        neighbors.forEach(neighborId => {
          if (!visited.has(neighborId)) {
            stack.push(neighborId);
          }
        });
      }
    }
    
    // Convert Set to Array and return node stub objects
    const connectedIds: string[] = [];
    connectedNodeIds.forEach(id => {
      connectedIds.push(id);
    });
    
    return connectedIds.map(id => ({ id } as any));
  }
  
  /**
   * Get all edges that belong to a specific flow
   */
  private static getFlowEdges(flowNodes: Node[], allEdges: Edge[]): Edge[] {
    const nodeIds = new Set(flowNodes.map(node => node.id));
    
    return allEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }
  
  /**
   * Calculate bounding box for a set of nodes
   */
  private static calculateBoundingBox(nodes: Node[]): {
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
  
}