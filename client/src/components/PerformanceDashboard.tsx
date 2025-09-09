import React, { useState, useEffect } from 'react';
import { performanceManager } from '@/lib/performance/performanceManager';
import { PerformanceSnapshot, PerformanceAlert } from '@/lib/performance/types';
import { Activity, Zap, Clock, AlertTriangle, CheckCircle, XCircle, TrendingUp, Server, Cpu, HardDrive } from 'lucide-react';

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export function PerformanceDashboard({ isVisible, onClose }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceSnapshot | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1m' | '5m' | '15m'>('1m');

  useEffect(() => {
    if (!isVisible) return;

    const unsubscribe = performanceManager.subscribe(setMetrics);
    const unsubscribeAlerts = performanceManager.subscribeToAlerts((alert) => {
      setAlerts(prev => [...prev.slice(-4), alert]); // Keep last 5 alerts
    });

    return () => {
      unsubscribe();
      unsubscribeAlerts();
    };
  }, [isVisible]);

  if (!isVisible || !metrics) return null;

  const { workflow, nodes, edges } = metrics;
  const nodeMetrics = Object.values(nodes);
  const edgeMetrics = Object.values(edges);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(0)}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': case 'active': return 'text-blue-500';
      case 'success': case 'completed': return 'text-green-500';
      case 'error': case 'failed': return 'text-red-500';
      case 'blocked': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': case 'active': return <Activity className="w-4 h-4" />;
      case 'success': case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'error': case 'failed': return <XCircle className="w-4 h-4" />;
      case 'blocked': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Performance Dashboard</h2>
              <p className="text-sm text-muted-foreground">Real-time workflow metrics and analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
            >
              <option value="1m">Last 1 minute</option>
              <option value="5m">Last 5 minutes</option>
              <option value="15m">Last 15 minutes</option>
            </select>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              data-testid="button-close-performance-dashboard"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-6 h-full">
            {/* Workflow Overview */}
            <div className="xl:col-span-2 space-y-6">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Avg Execution</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatDuration(workflow.overallExecutionTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {workflow.nodesProcessed}/{workflow.totalNodes} nodes
                  </p>
                </div>

                <div className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Success Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {(workflow.successRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last {nodeMetrics.reduce((sum, n) => sum + n.totalExecutions, 0)} runs
                  </p>
                </div>

                <div className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">Throughput</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {workflow.throughput.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">ops/sec</p>
                </div>

                <div className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium">Bottlenecks</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {workflow.bottlenecks.length}
                  </p>
                  <p className="text-xs text-muted-foreground">nodes affected</p>
                </div>
              </div>

              {/* Resource Utilization */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Resource Utilization
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        CPU Usage
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {workflow.resourceUtilization.cpu.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${workflow.resourceUtilization.cpu}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        Memory Usage
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatBytes(workflow.resourceUtilization.memory * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, workflow.resourceUtilization.memory / 5)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Network I/O
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {workflow.resourceUtilization.network.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${workflow.resourceUtilization.network}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Node Performance Table */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Node Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2">Node</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-right py-2">Exec Time</th>
                        <th className="text-right py-2">Success Rate</th>
                        <th className="text-right py-2">Throughput</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodeMetrics.slice(0, 8).map((node) => (
                        <tr key={node.nodeId} className="border-b border-border/50">
                          <td className="py-2 font-mono text-xs">
                            {node.nodeId.slice(-8)}
                          </td>
                          <td className="py-2">
                            <div className={`flex items-center gap-1 ${getStatusColor(node.status)}`}>
                              {getStatusIcon(node.status)}
                              <span className="capitalize">{node.status}</span>
                            </div>
                          </td>
                          <td className="py-2 text-right">
                            {formatDuration(node.executionTime)}
                          </td>
                          <td className="py-2 text-right">
                            {(node.successRate * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 text-right">
                            {node.throughput?.toFixed(1) || 0} ops/s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Alerts and Activity */}
            <div className="space-y-6">
              {/* Recent Alerts */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Recent Alerts
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent alerts</p>
                  ) : (
                    alerts.slice(-5).reverse().map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${
                          alert.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                          alert.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' :
                          'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                            alert.type === 'error' ? 'text-red-500' :
                            alert.type === 'warning' ? 'text-yellow-500' :
                            'text-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Edge Performance */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Data Flow</h3>
                <div className="space-y-3">
                  {edgeMetrics.slice(0, 5).map((edge) => (
                    <div key={edge.edgeId} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(edge.status).replace('text-', 'bg-')}`} />
                        <span className="text-sm font-mono">{edge.edgeId.slice(-6)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{edge.dataFlowRate.toFixed(1)} items/s</p>
                        <p className="text-xs text-muted-foreground">{formatDuration(edge.averageLatency)} latency</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}