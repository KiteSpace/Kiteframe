// Performance monitoring and data management system

import { 
  NodePerformanceMetrics, 
  EdgePerformanceMetrics, 
  WorkflowPerformanceMetrics,
  PerformanceSnapshot,
  PerformanceSettings,
  PerformanceAlert 
} from './types';

class PerformanceManager {
  private snapshots: PerformanceSnapshot[] = [];
  private currentMetrics: PerformanceSnapshot | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: ((snapshot: PerformanceSnapshot) => void)[] = [];
  private alertListeners: ((alert: PerformanceAlert) => void)[] = [];
  private settings: PerformanceSettings = {
    enabled: true,
    updateInterval: 1000,
    historyRetention: 100,
    animationSpeed: 1.0,
    showNodeMetrics: true,
    showEdgeMetrics: true,
    showWorkflowMetrics: true,
    alertThresholds: {
      executionTime: 5000,
      errorRate: 0.1,
      cpuUsage: 80,
      memoryUsage: 512
    }
  };

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.currentMetrics = {
      timestamp: Date.now(),
      nodes: {},
      edges: {},
      workflow: {
        workflowId: 'current',
        overallExecutionTime: 0,
        nodesProcessed: 0,
        totalNodes: 0,
        successRate: 1.0,
        bottlenecks: [],
        startTime: Date.now(),
        status: 'idle',
        throughput: 0,
        resourceUtilization: {
          cpu: 0,
          memory: 0,
          network: 0
        }
      }
    };
  }

  // Simulation methods to generate realistic performance data
  public simulateWorkflow(nodeIds: string[], edgeIds: string[]) {
    if (!this.settings.enabled) return;

    // Initialize metrics for all nodes and edges
    nodeIds.forEach(nodeId => {
      this.updateNodeMetrics(nodeId, this.generateRandomNodeMetrics(nodeId));
    });

    edgeIds.forEach(edgeId => {
      this.updateEdgeMetrics(edgeId, this.generateRandomEdgeMetrics(edgeId));
    });

    this.updateWorkflowMetrics(nodeIds.length);
    this.startRealTimeUpdates();
  }

  private generateRandomNodeMetrics(nodeId: string): Partial<NodePerformanceMetrics> {
    const baseExecTime = Math.random() * 2000 + 500; // 500-2500ms
    const variation = Math.random() * 0.4 + 0.8; // 80-120% variation
    
    return {
      executionTime: baseExecTime * variation,
      averageExecutionTime: baseExecTime,
      successRate: Math.random() * 0.3 + 0.7, // 70-100%
      errorCount: Math.floor(Math.random() * 5),
      totalExecutions: Math.floor(Math.random() * 100) + 10,
      lastExecutionTime: Date.now() - Math.random() * 60000,
      status: ['idle', 'running', 'success', 'error'][Math.floor(Math.random() * 4)] as any,
      cpuUsage: Math.random() * 80 + 10, // 10-90%
      memoryUsage: Math.random() * 200 + 50, // 50-250MB
      throughput: Math.random() * 50 + 5 // 5-55 ops/sec
    };
  }

  private generateRandomEdgeMetrics(edgeId: string): Partial<EdgePerformanceMetrics> {
    return {
      dataFlowRate: Math.random() * 100 + 10, // 10-110 items/sec
      totalDataTransferred: Math.floor(Math.random() * 10000) + 1000,
      averageLatency: Math.random() * 100 + 10, // 10-110ms
      errorRate: Math.random() * 0.1, // 0-10%
      bandwidth: Math.random() * 50 + 5, // 5-55 MB/s
      status: ['idle', 'active', 'blocked', 'error'][Math.floor(Math.random() * 4)] as any
    };
  }

  private startRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateCurrentMetrics();
      this.checkAlerts();
      this.notifyListeners();
    }, this.settings.updateInterval);
  }

  private updateCurrentMetrics() {
    if (!this.currentMetrics) return;

    // Update node metrics with small variations
    Object.keys(this.currentMetrics.nodes).forEach(nodeId => {
      const current = this.currentMetrics!.nodes[nodeId];
      const updates = this.generateRandomNodeMetrics(nodeId);
      this.currentMetrics!.nodes[nodeId] = { ...current, ...updates };
    });

    // Update edge metrics
    Object.keys(this.currentMetrics.edges).forEach(edgeId => {
      const current = this.currentMetrics!.edges[edgeId];
      const updates = this.generateRandomEdgeMetrics(edgeId);
      this.currentMetrics!.edges[edgeId] = { ...current, ...updates };
    });

    // Update workflow metrics
    this.updateWorkflowMetrics(Object.keys(this.currentMetrics.nodes).length);

    // Store snapshot
    this.addSnapshot(this.currentMetrics);
  }

  private updateWorkflowMetrics(totalNodes: number) {
    if (!this.currentMetrics) return;

    const nodes = Object.values(this.currentMetrics.nodes);
    const avgExecutionTime = nodes.reduce((sum, node) => sum + node.executionTime, 0) / nodes.length || 0;
    const successRate = nodes.reduce((sum, node) => sum + node.successRate, 0) / nodes.length || 1;
    const bottlenecks = nodes
      .filter(node => node.executionTime > this.settings.alertThresholds.executionTime)
      .map(node => node.nodeId);

    this.currentMetrics.workflow = {
      ...this.currentMetrics.workflow,
      overallExecutionTime: avgExecutionTime,
      totalNodes,
      nodesProcessed: nodes.filter(n => n.status !== 'idle').length,
      successRate,
      bottlenecks,
      throughput: nodes.reduce((sum, node) => sum + (node.throughput || 0), 0),
      resourceUtilization: {
        cpu: Math.random() * 60 + 20, // 20-80%
        memory: Math.random() * 300 + 100, // 100-400MB
        network: Math.random() * 80 + 10 // 10-90%
      }
    };
  }

  private checkAlerts() {
    if (!this.currentMetrics) return;

    // Check for performance alerts
    Object.values(this.currentMetrics.nodes).forEach(node => {
      if (node.executionTime > this.settings.alertThresholds.executionTime) {
        this.createAlert('warning', `Node ${node.nodeId} execution time is high: ${node.executionTime.toFixed(0)}ms`, node.nodeId);
      }
      if (node.successRate < (1 - this.settings.alertThresholds.errorRate)) {
        this.createAlert('error', `Node ${node.nodeId} has high error rate: ${((1 - node.successRate) * 100).toFixed(1)}%`, node.nodeId);
      }
    });
  }

  private createAlert(type: 'warning' | 'error' | 'info', message: string, nodeId?: string, edgeId?: string) {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      nodeId,
      edgeId,
      timestamp: Date.now(),
      resolved: false
    };

    this.alertListeners.forEach(listener => listener(alert));
  }

  public updateNodeMetrics(nodeId: string, metrics: Partial<NodePerformanceMetrics>) {
    if (!this.currentMetrics) return;

    const existing = this.currentMetrics.nodes[nodeId] || {
      nodeId,
      executionTime: 0,
      averageExecutionTime: 0,
      successRate: 1,
      errorCount: 0,
      totalExecutions: 0,
      lastExecutionTime: Date.now(),
      status: 'idle' as const
    };

    this.currentMetrics.nodes[nodeId] = { ...existing, ...metrics };
  }

  public updateEdgeMetrics(edgeId: string, metrics: Partial<EdgePerformanceMetrics>) {
    if (!this.currentMetrics) return;

    const existing = this.currentMetrics.edges[edgeId] || {
      edgeId,
      dataFlowRate: 0,
      totalDataTransferred: 0,
      averageLatency: 0,
      errorRate: 0,
      bandwidth: 0,
      status: 'idle' as const
    };

    this.currentMetrics.edges[edgeId] = { ...existing, ...metrics };
  }

  private addSnapshot(snapshot: PerformanceSnapshot) {
    this.snapshots.push({ ...snapshot, timestamp: Date.now() });
    
    // Keep only recent snapshots
    if (this.snapshots.length > this.settings.historyRetention) {
      this.snapshots.shift();
    }
  }

  private notifyListeners() {
    if (!this.currentMetrics) return;
    this.listeners.forEach(listener => listener(this.currentMetrics!));
  }

  // Public API
  public subscribe(listener: (snapshot: PerformanceSnapshot) => void) {
    this.listeners.push(listener);
    if (this.currentMetrics) {
      listener(this.currentMetrics);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public subscribeToAlerts(listener: (alert: PerformanceAlert) => void) {
    this.alertListeners.push(listener);
    return () => {
      this.alertListeners = this.alertListeners.filter(l => l !== listener);
    };
  }

  public getCurrentMetrics(): PerformanceSnapshot | null {
    return this.currentMetrics;
  }

  public getHistory(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  public updateSettings(newSettings: Partial<PerformanceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (this.updateInterval && this.settings.enabled) {
      this.startRealTimeUpdates();
    } else if (!this.settings.enabled && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public getSettings(): PerformanceSettings {
    return { ...this.settings };
  }

  public reset() {
    this.snapshots = [];
    this.initializeMetrics();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.listeners = [];
    this.alertListeners = [];
  }
}

export const performanceManager = new PerformanceManager();