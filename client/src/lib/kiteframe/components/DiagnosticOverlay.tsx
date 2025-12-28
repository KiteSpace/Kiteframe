import { memo, useMemo, useCallback } from 'react';
import type { Node } from '../types';
import type { DiagnosticIssue } from '../utils/diagnostics/types';
import { DiagnosticBadge } from './DiagnosticBadge';

interface DiagnosticOverlayProps {
  nodes: Node[];
  viewport: { x: number; y: number; zoom: number };
  issues?: DiagnosticIssue[];
  onAcknowledge?: (fingerprint: string) => void;
  onUnacknowledge?: (fingerprint: string) => void;
  onViewInPanel?: (issue: DiagnosticIssue) => void;
  onCreateExperiment?: (issue: DiagnosticIssue) => void;
  minZoom?: number;
}

const MIN_ZOOM_THRESHOLD = 0.35;

export const DiagnosticOverlay = memo(function DiagnosticOverlay({
  nodes,
  viewport,
  issues = [],
  onAcknowledge,
  onUnacknowledge,
  onViewInPanel,
  onCreateExperiment,
  minZoom = MIN_ZOOM_THRESHOLD,
}: DiagnosticOverlayProps) {
  if (viewport.zoom < minZoom) return null;
  const getIssuesForNode = useCallback((nodeId: string) => {
    return issues.filter(i => i.nodeId === nodeId && i.status !== 'resolved');
  }, [issues]);
  
  const nodesWithIssues = useMemo(() => {
    return nodes
      .filter(node => !node.meta?.speculative)
      .map(node => ({
        node,
        issues: getIssuesForNode(node.id),
      }))
      .filter(({ issues }) => issues.length > 0);
  }, [nodes, getIssuesForNode]);
  
  if (nodesWithIssues.length === 0) return null;
  
  const handleViewInPanel = (issue: DiagnosticIssue) => {
    onViewInPanel?.(issue);
  };
  
  const handleCreateExperiment = (issue: DiagnosticIssue) => {
    onCreateExperiment?.(issue);
  };
  
  return (
    <div 
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 45 }}
      data-testid="diagnostic-overlay"
    >
      {nodesWithIssues.map(({ node, issues: nodeIssues }) => {
        const nodeWidth = node.style?.width || node.width || 220;
        const screenX = (node.position.x + nodeWidth) * viewport.zoom + viewport.x;
        const screenY = node.position.y * viewport.zoom + viewport.y;
        
        return (
          <div
            key={node.id}
            className="pointer-events-auto absolute"
            style={{
              left: screenX - 8,
              top: screenY - 8,
              transform: `scale(${Math.min(1, viewport.zoom + 0.3)})`,
              transformOrigin: 'top right',
              willChange: 'left, top, transform',
            }}
            data-testid={`diagnostic-overlay-${node.id}`}
          >
            <DiagnosticBadge
              issues={nodeIssues}
              onAcknowledge={onAcknowledge}
              onUnacknowledge={onUnacknowledge}
              onCreateExperiment={handleCreateExperiment}
              onViewInPanel={handleViewInPanel}
              position="top-right"
            />
          </div>
        );
      })}
    </div>
  );
});
