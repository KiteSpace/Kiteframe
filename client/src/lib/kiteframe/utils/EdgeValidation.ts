import { Node, Edge } from '../types';

export interface EdgeValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface EdgeValidationRules {
  allowSelfLoops?: boolean;
  allowDuplicates?: boolean;
  maxConnectionsPerNode?: number;
  nodeTypeRestrictions?: {
    [nodeType: string]: {
      allowedSources?: string[];
      allowedTargets?: string[];
    };
  };
  customValidation?: (edge: Edge, nodes: Node[]) => EdgeValidationResult;
}

export class EdgeValidator {
  private rules: EdgeValidationRules;

  constructor(rules: EdgeValidationRules = {}) {
    this.rules = {
      allowSelfLoops: false,
      allowDuplicates: false,
      maxConnectionsPerNode: Infinity,
      ...rules
    };
  }

  validateEdge(
    edge: Edge,
    existingEdges: Edge[],
    nodes: Node[]
  ): EdgeValidationResult {
    const warnings: string[] = [];

    // Check if source and target nodes exist
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode) {
      return {
        isValid: false,
        error: `Source node '${edge.source}' not found`
      };
    }

    if (!targetNode) {
      return {
        isValid: false,
        error: `Target node '${edge.target}' not found`
      };
    }

    // Check self-loop
    if (!this.rules.allowSelfLoops && edge.source === edge.target) {
      return {
        isValid: false,
        error: 'Self-loops are not allowed'
      };
    }

    // Check duplicates
    if (!this.rules.allowDuplicates) {
      const duplicate = existingEdges.find(
        e => e.id !== edge.id && 
        e.source === edge.source && 
        e.target === edge.target
      );
      
      if (duplicate) {
        return {
          isValid: false,
          error: 'Duplicate connections are not allowed'
        };
      }
    }

    // Check max connections per node
    if (this.rules.maxConnectionsPerNode !== Infinity) {
      const sourceConnections = existingEdges.filter(
        e => (e.source === edge.source || e.target === edge.source) && e.id !== edge.id
      ).length;
      
      const targetConnections = existingEdges.filter(
        e => (e.source === edge.target || e.target === edge.target) && e.id !== edge.id
      ).length;

      if (this.rules.maxConnectionsPerNode && sourceConnections >= this.rules.maxConnectionsPerNode) {
        return {
          isValid: false,
          error: `Source node has reached maximum connections (${this.rules.maxConnectionsPerNode})`
        };
      }

      if (this.rules.maxConnectionsPerNode && targetConnections >= this.rules.maxConnectionsPerNode) {
        return {
          isValid: false,
          error: `Target node has reached maximum connections (${this.rules.maxConnectionsPerNode})`
        };
      }
    }

    // Check node type restrictions
    if (this.rules.nodeTypeRestrictions && sourceNode.type && targetNode.type) {
      const sourceRestrictions = this.rules.nodeTypeRestrictions[sourceNode.type];
      const targetRestrictions = this.rules.nodeTypeRestrictions[targetNode.type];

      if (sourceRestrictions?.allowedTargets) {
        if (!sourceRestrictions.allowedTargets.includes(targetNode.type)) {
          return {
            isValid: false,
            error: `Node type '${sourceNode.type}' cannot connect to '${targetNode.type}'`
          };
        }
      }

      if (targetRestrictions?.allowedSources) {
        if (!targetRestrictions.allowedSources.includes(sourceNode.type)) {
          return {
            isValid: false,
            error: `Node type '${targetNode.type}' cannot accept connections from '${sourceNode.type}'`
          };
        }
      }
    }

    // Run custom validation if provided
    if (this.rules.customValidation) {
      const customResult = this.rules.customValidation(edge, nodes);
      if (!customResult.isValid) {
        return customResult;
      }
      if (customResult.warnings) {
        warnings.push(...customResult.warnings);
      }
    }

    // Check for cycles (warning only)
    if (this.createsCycle(edge, existingEdges)) {
      warnings.push('This connection creates a cycle in the workflow');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private createsCycle(newEdge: Edge, existingEdges: Edge[]): boolean {
    const edges = [...existingEdges, newEdge];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = edges.filter(e => e.source === nodeId);
      
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          if (hasCycleDFS(edge.target)) {
            return true;
          }
        } else if (recursionStack.has(edge.target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Find all nodes
    const nodeIds = new Set<string>();
    edges.forEach(e => {
      nodeIds.add(e.source);
      nodeIds.add(e.target);
    });

    // Check for cycles starting from each unvisited node
    const nodeIdsArray = Array.from(nodeIds);
    for (const nodeId of nodeIdsArray) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  updateRules(rules: Partial<EdgeValidationRules>): void {
    this.rules = { ...this.rules, ...rules };
  }

  getRules(): EdgeValidationRules {
    return { ...this.rules };
  }
}