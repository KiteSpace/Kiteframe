// Performance monitoring types for workflow visualization

export interface NodePerformanceMetrics {
  nodeId: string;
  executionTime: number; // milliseconds
  averageExecutionTime: number;
  successRate: number; // 0-1
  errorCount: number;
  totalExecutions: number;
  lastExecutionTime: number;
  status: 'idle' | 'running' | 'success' | 'error';
  cpuUsage?: number; // 0-100
  memoryUsage?: number; // MB
  throughput?: number; // operations per second
}

export interface EdgePerformanceMetrics {
  edgeId: string;
  dataFlowRate: number; // items per second
  totalDataTransferred: number;
  averageLatency: number; // milliseconds
  errorRate: number; // 0-1
  bandwidth: number; // MB/s
  status: 'idle' | 'active' | 'blocked' | 'error';
}

export interface WorkflowPerformanceMetrics {
  workflowId: string;
  overallExecutionTime: number;
  nodesProcessed: number;
  totalNodes: number;
  successRate: number;
  bottlenecks: string[]; // node IDs with performance issues
  startTime: number;
  endTime?: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  throughput: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export interface PerformanceSnapshot {
  timestamp: number;
  nodes: Record<string, NodePerformanceMetrics>;
  edges: Record<string, EdgePerformanceMetrics>;
  workflow: WorkflowPerformanceMetrics;
}

export interface PerformanceSettings {
  enabled: boolean;
  updateInterval: number; // milliseconds
  historyRetention: number; // number of snapshots to keep
  animationSpeed: number; // 0.1 - 2.0
  showNodeMetrics: boolean;
  showEdgeMetrics: boolean;
  showWorkflowMetrics: boolean;
  alertThresholds: {
    executionTime: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  nodeId?: string;
  edgeId?: string;
  timestamp: number;
  resolved: boolean;
}