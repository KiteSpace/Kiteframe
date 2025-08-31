import type { KiteFramePlugin } from '../../core/KiteFrameCore';
import type { Node } from '../../types';

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

    // Listen for layout events
    core.on('layout:horizontal', () => {
      const nodes = context.getNodes();
      const layouted = this.horizontalFlow(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:vertical', () => {
      const nodes = context.getNodes();
      const layouted = this.verticalFlow(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:grid', () => {
      const nodes = context.getNodes();
      const layouted = this.gridLayout(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:circular', () => {
      const nodes = context.getNodes();
      const layouted = this.circularLayout(nodes);
      context.updateNodes(layouted);
    });

    core.on('layout:hierarchical', () => {
      const nodes = context.getNodes();
      const edges = context.getEdges();
      const layouted = this.hierarchicalLayout(nodes, edges);
      context.updateNodes(layouted);
    });

    console.log('Layout Plugin initialized');
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