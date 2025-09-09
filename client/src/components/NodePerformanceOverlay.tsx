import React from 'react';
import { NodePerformanceMetrics } from '@/lib/performance/types';
import { Activity, Clock, Zap, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface NodePerformanceOverlayProps {
  metrics: NodePerformanceMetrics;
  nodePosition: { x: number; y: number };
  nodeSize: { width: number; height: number };
  zoom: number;
  showDetails: boolean;
}

export function NodePerformanceOverlay({ 
  metrics, 
  nodePosition, 
  nodeSize, 
  zoom, 
  showDetails 
}: NodePerformanceOverlayProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity className="w-3 h-3" />;
      case 'success': return <CheckCircle className="w-3 h-3" />;
      case 'error': return <XCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const isHighExecution = metrics.executionTime > 3000;
  const isLowSuccess = metrics.successRate < 0.8;

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        left: nodePosition.x,
        top: nodePosition.y,
        width: nodeSize.width,
        height: nodeSize.height,
      }}
    >
      {/* Status indicator dot */}
      <div
        className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(metrics.status)} flex items-center justify-center`}
      >
        <div className="text-white text-xs">
          {getStatusIcon(metrics.status)}
        </div>
      </div>

      {/* Performance warning indicators */}
      {(isHighExecution || isLowSuccess) && (
        <div className="absolute -top-3 -left-3">
          <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-3 h-3 text-white" />
          </div>
        </div>
      )}

      {/* Execution time bar */}
      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded">
        <div
          className={`h-full rounded transition-all duration-1000 ease-out ${
            isHighExecution ? 'bg-red-500' : 'bg-green-500'
          }`}
          style={{
            width: `${Math.min(100, (metrics.executionTime / 5000) * 100)}%`
          }}
        />
      </div>

      {/* Throughput indicator */}
      {metrics.throughput && metrics.throughput > 0 && (
        <div className="absolute -right-8 top-1/2 -translate-y-1/2">
          <div className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
            <Zap className="w-3 h-3 inline mr-1" />
            {metrics.throughput.toFixed(0)}
          </div>
        </div>
      )}

      {/* Detailed metrics popup */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-xl p-3 z-50 min-w-48 pointer-events-auto">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`capitalize flex items-center gap-1 ${
                metrics.status === 'running' ? 'text-blue-500' :
                metrics.status === 'success' ? 'text-green-500' :
                metrics.status === 'error' ? 'text-red-500' :
                'text-gray-500'
              }`}>
                {getStatusIcon(metrics.status)}
                {metrics.status}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Execution:</span>
              <span className="font-mono">{formatDuration(metrics.executionTime)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average:</span>
              <span className="font-mono">{formatDuration(metrics.averageExecutionTime)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Success Rate:</span>
              <span className={`font-medium ${isLowSuccess ? 'text-red-500' : 'text-green-500'}`}>
                {(metrics.successRate * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Runs:</span>
              <span>{metrics.totalExecutions}</span>
            </div>
            
            {metrics.errorCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Errors:</span>
                <span className="text-red-500">{metrics.errorCount}</span>
              </div>
            )}
            
            {metrics.cpuUsage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU:</span>
                <span>{metrics.cpuUsage.toFixed(1)}%</span>
              </div>
            )}
            
            {metrics.memoryUsage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory:</span>
                <span>{metrics.memoryUsage.toFixed(0)}MB</span>
              </div>
            )}
            
            {metrics.throughput && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Throughput:</span>
                <span>{metrics.throughput.toFixed(1)} ops/s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Animated pulse for running nodes */}
      {metrics.status === 'running' && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-lg animate-pulse opacity-50" />
      )}
    </div>
  );
}