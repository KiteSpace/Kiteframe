import React from 'react';
import { EdgePerformanceMetrics } from '@/lib/performance/types';
import { Activity, Zap, AlertTriangle, TrendingUp } from 'lucide-react';

interface EdgePerformanceOverlayProps {
  metrics: EdgePerformanceMetrics;
  edgeStart: { x: number; y: number };
  edgeEnd: { x: number; y: number };
  zoom: number;
  showDetails: boolean;
}

export function EdgePerformanceOverlay({ 
  metrics, 
  edgeStart, 
  edgeEnd, 
  zoom, 
  showDetails 
}: EdgePerformanceOverlayProps) {
  // Calculate midpoint for positioning indicators
  const midpoint = {
    x: (edgeStart.x + edgeEnd.x) / 2,
    y: (edgeStart.y + edgeEnd.y) / 2
  };

  const formatRate = (rate: number) => {
    if (rate < 1) return `${(rate * 1000).toFixed(0)}/s`;
    if (rate < 1000) return `${rate.toFixed(1)}/s`;
    return `${(rate / 1000).toFixed(1)}k/s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(0)}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'blocked': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const isHighLatency = metrics.averageLatency > 500;
  const isHighErrorRate = metrics.errorRate > 0.05;
  const hasHighTraffic = metrics.dataFlowRate > 50;

  return (
    <div className="absolute pointer-events-none z-15">
      {/* Data flow indicator at midpoint */}
      {metrics.status === 'active' && metrics.dataFlowRate > 0 && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: midpoint.x,
            top: midpoint.y,
          }}
        >
          {/* Animated flow indicator */}
          <div className={`w-6 h-6 rounded-full ${getStatusColor(metrics.status)} flex items-center justify-center animate-pulse`}>
            <Activity className="w-3 h-3 text-white" />
          </div>
          
          {/* Flow rate badge */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-card border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
            {formatRate(metrics.dataFlowRate)}
          </div>
        </div>
      )}

      {/* Warning indicators for performance issues */}
      {(isHighLatency || isHighErrorRate) && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: midpoint.x - 20,
            top: midpoint.y - 20,
          }}
        >
          <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center animate-bounce">
            <AlertTriangle className="w-2 h-2 text-white" />
          </div>
        </div>
      )}

      {/* High traffic indicator */}
      {hasHighTraffic && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: midpoint.x + 20,
            top: midpoint.y - 20,
          }}
        >
          <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
            <TrendingUp className="w-2 h-2 text-white" />
          </div>
        </div>
      )}

      {/* Animated flow particles for active edges */}
      {metrics.status === 'active' && metrics.dataFlowRate > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{
            left: Math.min(edgeStart.x, edgeEnd.x) - 50,
            top: Math.min(edgeStart.y, edgeEnd.y) - 50,
            width: Math.abs(edgeEnd.x - edgeStart.x) + 100,
            height: Math.abs(edgeEnd.y - edgeStart.y) + 100,
          }}
        >
          {/* Flow particles */}
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              r="2"
              fill="currentColor"
              className="text-primary animate-pulse"
              style={{
                animationDelay: `${i * 0.5}s`,
                animationDuration: '2s',
              }}
            >
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                begin={`${i * 0.7}s`}
              >
                <mpath href="#flowPath" />
              </animateMotion>
            </circle>
          ))}
          
          {/* Hidden path for animation */}
          <defs>
            <path
              id="flowPath"
              d={`M ${edgeStart.x - Math.min(edgeStart.x, edgeEnd.x) + 50} ${edgeStart.y - Math.min(edgeStart.y, edgeEnd.y) + 50} 
                  L ${edgeEnd.x - Math.min(edgeStart.x, edgeEnd.x) + 50} ${edgeEnd.y - Math.min(edgeStart.y, edgeEnd.y) + 50}`}
            />
          </defs>
        </svg>
      )}

      {/* Detailed metrics tooltip */}
      {showDetails && (
        <div
          className="absolute bg-card border border-border rounded-lg shadow-xl p-3 z-50 min-w-48 pointer-events-auto"
          style={{
            left: midpoint.x + 30,
            top: midpoint.y - 60,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`capitalize flex items-center gap-1 ${
                metrics.status === 'active' ? 'text-green-500' :
                metrics.status === 'blocked' ? 'text-yellow-500' :
                metrics.status === 'error' ? 'text-red-500' :
                'text-gray-500'
              }`}>
                <Activity className="w-3 h-3" />
                {metrics.status}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flow Rate:</span>
              <span className="font-mono">{formatRate(metrics.dataFlowRate)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latency:</span>
              <span className={`font-mono ${isHighLatency ? 'text-red-500' : 'text-foreground'}`}>
                {metrics.averageLatency.toFixed(0)}ms
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Error Rate:</span>
              <span className={`font-medium ${isHighErrorRate ? 'text-red-500' : 'text-green-500'}`}>
                {(metrics.errorRate * 100).toFixed(2)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bandwidth:</span>
              <span className="font-mono">{formatBytes(metrics.bandwidth * 1024 * 1024)}/s</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Data:</span>
              <span className="font-mono">{formatBytes(metrics.totalDataTransferred)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bandwidth visualization */}
      {metrics.bandwidth > 0 && (
        <div
          className="absolute transform -translate-x-1/2"
          style={{
            left: midpoint.x,
            top: midpoint.y + 25,
          }}
        >
          <div className="bg-background border border-border rounded px-2 py-1 text-xs">
            <Zap className="w-3 h-3 inline mr-1 text-blue-500" />
            {formatBytes(metrics.bandwidth * 1024 * 1024)}/s
          </div>
        </div>
      )}
    </div>
  );
}