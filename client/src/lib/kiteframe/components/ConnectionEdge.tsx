import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Edge, Node, EdgeStyle, EdgeMarker } from '../types';
import { NEEDS_LABEL_SENTINEL, isNeedsLabelSentinel } from '@/ai/repair/decisionRepair';

function getDisplayLabel(label: string | undefined): string | null {
  if (!label) return null;
  if (isNeedsLabelSentinel(label)) return null;
  return label;
}

// Direction type for edge anchor points
type AnchorDirection = 'left' | 'right' | 'top' | 'bottom';

interface AnchorResult {
  x: number;
  y: number;
  direction: AnchorDirection;
}

function anchor(node: Node, toward: Node): AnchorResult {
  // Use measuredWidth/measuredHeight (transient DOM measurements) if available, for accurate edge tracking
  const w = node.measuredWidth ?? node.style?.width ?? node.width ?? 200;
  const h = node.measuredHeight ?? node.style?.height ?? node.height ?? 100;
  const x = node.position.x, y = node.position.y;
  const cx = x + w/2, cy = y + h/2;
  const tw = toward.measuredWidth ?? toward.style?.width ?? toward.width ?? 200;
  const th = toward.measuredHeight ?? toward.style?.height ?? toward.height ?? 100;
  const tcx = toward.position.x + tw/2, tcy = toward.position.y + th/2;
  const dx = tcx - cx, dy = tcy - cy;
  const angle = Math.atan2(dy, dx);
  const ha = Math.abs(angle) < Math.PI/4 || Math.abs(angle) > 3*Math.PI/4;
  
  // Edge endpoints connect at exact node boundaries to align with NodeHandles centers
  if (ha) {
    return dx > 0 
      ? { x: x + w, y: cy, direction: 'right' } 
      : { x, y: cy, direction: 'left' };
  }
  return dy > 0 
    ? { x: cx, y: y + h, direction: 'bottom' } 
    : { x: cx, y, direction: 'top' };
}

// Helper function to round coordinates for crisp rendering
const r = (n: number) => Math.round(n);

// Helper function to generate path based on edge type
function generatePath(
  type: string, 
  s: AnchorResult, 
  t: AnchorResult, 
  options: any = {}
) {
  const { curvature = 0.5, cornerRadius = 10, controlPoint } = options;
  
  // Round source and target coordinates for pixel-perfect rendering
  const sx = r(s.x), sy = r(s.y);
  const tx = r(t.x), ty = r(t.y);

  // For non-step/orthogonal types: a user-dragged control point overrides the
  // entire path with a quadratic Bézier.  The stored value is the point ON the
  // curve at t=0.5, so we back-calculate the true Q control point so the handle
  // sits exactly on the path: cp = 2·stored − (S+T)/2
  if (controlPoint && type !== 'step' && type !== 'orthogonal') {
    const cpx = r(2 * controlPoint.x - (sx + tx) / 2);
    const cpy = r(2 * controlPoint.y - (sy + ty) / 2);
    return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
  }
  
  // Calculate control point offset based on distance, clamped for reasonable curves
  const distance = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));
  const controlOffset = Math.min(Math.max(30, distance * 0.4), 150); // Clamp between 30-150
  
  // Get control point offsets based on anchor directions (with safe default)
  const getControlOffset = (dir: AnchorDirection | undefined, offset: number): { dx: number; dy: number } => {
    switch (dir) {
      case 'right': return { dx: offset, dy: 0 };
      case 'left': return { dx: -offset, dy: 0 };
      case 'bottom': return { dx: 0, dy: offset };
      case 'top': return { dx: 0, dy: -offset };
      default: return { dx: 0, dy: 0 }; // Safe fallback
    }
  };
  
  // Get direction-aware control points for source and target
  const sourceOffset = getControlOffset(s.direction, controlOffset);
  const targetOffset = getControlOffset(t.direction, controlOffset);
  
  switch (type) {
    case 'straight':
      return `M ${sx} ${sy} L ${tx} ${ty}`;
      
    case 'step': {
      // Direction-aware step: use source direction to determine first leg
      const isSourceHorizontal = s.direction === 'left' || s.direction === 'right';
      const isTargetHorizontal = t.direction === 'left' || t.direction === 'right';
      
      if (isSourceHorizontal && isTargetHorizontal) {
        // Both horizontal: control point X sets the elbow column position
        const mx = controlPoint ? r(controlPoint.x) : r(sx + (tx - sx) / 2);
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - mx) / 2, Math.abs(ty - sy) / 2);
          const ddx = tx > mx ? 1 : -1;
          const ddy = ty > sy ? 1 : -1;
          return `M ${sx} ${sy} L ${r(mx - rad * ddx)} ${sy} Q ${mx} ${sy} ${mx} ${r(sy + rad * ddy)} L ${mx} ${r(ty - rad * ddy)} Q ${mx} ${ty} ${r(mx + rad * ddx)} ${ty} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else if (!isSourceHorizontal && !isTargetHorizontal) {
        // Both vertical: control point Y sets the elbow row position
        const my = controlPoint ? r(controlPoint.y) : r(sy + (ty - sy) / 2);
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(ty - my) / 2, Math.abs(tx - sx) / 2);
          const ddx = tx > sx ? 1 : -1;
          const ddy = ty > my ? 1 : -1;
          return `M ${sx} ${sy} L ${sx} ${r(my - rad * ddy)} Q ${sx} ${my} ${r(sx + rad * ddx)} ${my} L ${r(tx - rad * ddx)} ${my} Q ${tx} ${my} ${tx} ${r(my + rad * ddy)} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      } else {
        // Mixed: single-corner path — if user has set a control point use Q bezier
        if (controlPoint) {
          const cpx = r(2 * controlPoint.x - (sx + tx) / 2);
          const cpy = r(2 * controlPoint.y - (sy + ty) / 2);
          return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
        }
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2);
          if (isSourceHorizontal) {
            const ddx = tx > sx ? 1 : -1;
            const ddy = ty > sy ? 1 : -1;
            return `M ${sx} ${sy} L ${r(tx - rad * ddx)} ${sy} Q ${tx} ${sy} ${tx} ${r(sy + rad * ddy)} L ${tx} ${ty}`;
          } else {
            const ddx = tx > sx ? 1 : -1;
            const ddy = ty > sy ? 1 : -1;
            return `M ${sx} ${sy} L ${sx} ${r(ty - rad * ddy)} Q ${sx} ${ty} ${r(sx + rad * ddx)} ${ty} L ${tx} ${ty}`;
          }
        }
        if (isSourceHorizontal) {
          return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
        } else {
          return `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
        }
      }
    }
      
    case 'smoothstep': {
      // Direction-aware smoothstep
      const isSourceHorizontal = s.direction === 'left' || s.direction === 'right';
      if (isSourceHorizontal) {
        const smx = r(sx + (tx - sx) / 2);
        const curve = r(Math.min(Math.abs(ty - sy) * 0.3, 50));
        return `M ${sx} ${sy} C ${r(sx + curve)} ${sy}, ${r(smx - curve)} ${sy}, ${smx} ${sy} L ${smx} ${ty} C ${r(smx + curve)} ${ty}, ${r(tx - curve)} ${ty}, ${tx} ${ty}`;
      } else {
        const smy = r(sy + (ty - sy) / 2);
        const curve = r(Math.min(Math.abs(tx - sx) * 0.3, 50));
        return `M ${sx} ${sy} C ${sx} ${r(sy + curve)}, ${sx} ${r(smy - curve)}, ${sx} ${smy} L ${tx} ${smy} C ${tx} ${r(smy + curve)}, ${tx} ${r(ty - curve)}, ${tx} ${ty}`;
      }
    }
      
    case 'curved': {
      // Direction-aware curved path using quadratic bezier
      const curvedOffset = Math.min(distance * curvature * 0.5, 100);
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const angle = Math.atan2(ty - sy, tx - sx) + Math.PI / 2;
      const cx = r(midX + Math.cos(angle) * curvedOffset);
      const cy = r(midY + Math.sin(angle) * curvedOffset);
      return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
    }
      
    case 'orthogonal': {
      // Direction-aware orthogonal: enter/exit perpendicular to connected sides
      const isSourceHorizontal = s.direction === 'left' || s.direction === 'right';
      const isTargetHorizontal = t.direction === 'left' || t.direction === 'right';
      
      if (isSourceHorizontal && isTargetHorizontal) {
        // Both horizontal: control point X sets the elbow column
        const mx = controlPoint ? r(controlPoint.x) : r((sx + tx) / 2);
        return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else if (!isSourceHorizontal && !isTargetHorizontal) {
        // Both vertical: control point Y sets the elbow row
        const my = controlPoint ? r(controlPoint.y) : r((sy + ty) / 2);
        return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      } else if (isSourceHorizontal && !isTargetHorizontal) {
        // Single-corner: if user has set a control point use Q bezier
        if (controlPoint) {
          const cpx = r(2 * controlPoint.x - (sx + tx) / 2);
          const cpy = r(2 * controlPoint.y - (sy + ty) / 2);
          return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      } else {
        // Single-corner: if user has set a control point use Q bezier
        if (controlPoint) {
          const cpx = r(2 * controlPoint.x - (sx + tx) / 2);
          const cpy = r(2 * controlPoint.y - (sy + ty) / 2);
          return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
      }
    }
      
    default: // bezier - direction-aware control points
      const c1x = r(sx + sourceOffset.dx);
      const c1y = r(sy + sourceOffset.dy);
      const c2x = r(tx + targetOffset.dx);
      const c2y = r(ty + targetOffset.dy);
      
      return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  }
}

// Helper function to create marker based on type
function createMarker(
  markerId: string, 
  markerConfig: EdgeMarker | undefined, 
  defaultColor: string
) {
  const config = markerConfig || { type: 'arrow' };
  const { type = 'arrow', size = 6, color = defaultColor } = config;
  
  const viewBoxSize = size + 4;
  const refPoint = viewBoxSize - 1;
  
  switch (type) {
    case 'circle':
      return (
        <marker 
          id={markerId} 
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          refX={refPoint} 
          refY={viewBoxSize / 2} 
          markerWidth={size} 
          markerHeight={size} 
          orient="auto"
          markerUnits="strokeWidth"
        >
          <circle cx={viewBoxSize / 2} cy={viewBoxSize / 2} r={size / 2} fill={color} />
        </marker>
      );
      
    case 'square':
      return (
        <marker 
          id={markerId} 
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          refX={refPoint} 
          refY={viewBoxSize / 2} 
          markerWidth={size} 
          markerHeight={size} 
          orient="auto"
          markerUnits="strokeWidth"
        >
          <rect x={2} y={2} width={size} height={size} fill={color} />
        </marker>
      );
      
    case 'diamond':
      const center = viewBoxSize / 2;
      const half = size / 2;
      return (
        <marker 
          id={markerId} 
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          refX={refPoint} 
          refY={center} 
          markerWidth={size} 
          markerHeight={size} 
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points={`${center},${center - half} ${center + half},${center} ${center},${center + half} ${center - half},${center}`} fill={color} />
        </marker>
      );
      
    case 'triangle':
      return (
        <marker 
          id={markerId} 
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          refX={refPoint} 
          refY={viewBoxSize / 2} 
          markerWidth={size} 
          markerHeight={size} 
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points={`2,2 2,${viewBoxSize - 2} ${viewBoxSize - 2},${viewBoxSize / 2}`} fill={color} />
        </marker>
      );
      
    default: // arrow
      return (
        <marker 
          id={markerId} 
          viewBox="0 0 10 10" 
          refX="9" 
          refY="5" 
          markerWidth={size} 
          markerHeight={size} 
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0,0 0,10 10,5" fill={color} />
        </marker>
      );
  }
}

// Inline editor component for edge labels
const EdgeLabelEditor: React.FC<{
  edge: Edge;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  textColor: string;
  onSave: (newLabel: string) => void;
  onCancel: () => void;
}> = ({ edge, x, y, strokeColor, backgroundColor, textColor, onSave, onCancel }) => {
  const [value, setValue] = useState(edge.label || '');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Focus input when mounted
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  
  const handleBlur = () => {
    onSave(value);
  };
  
  const inputWidth = Math.max(80, value.length * 8 + 24);
  
  return (
    <foreignObject
      x={x - inputWidth / 2}
      y={y - 12}
      width={inputWidth}
      height={24}
      style={{ overflow: 'visible' }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: '100%',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: 500,
          textAlign: 'center',
          border: `1.5px solid ${strokeColor}`,
          borderRadius: '4px',
          backgroundColor,
          color: textColor,
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
        placeholder="Enter label..."
        data-testid="edge-label-input"
      />
    </foreignObject>
  );
};

export const ConnectionEdge: React.FC<{ 
  edge: Edge; 
  sourceNode: Node; 
  targetNode: Node;
  onEdgeClick?: (edge: Edge) => void;
  onEdgeDoubleClick?: (edge: Edge) => void;
  isEditing?: boolean;
  onLabelSave?: (edgeId: string, newLabel: string) => void;
  onLabelCancel?: () => void;
  canvasScale?: number;
  onControlPointChange?: (edgeId: string, cp: { x: number; y: number } | null) => void;
  onControlPointDragStart?: (edgeId: string) => void;
}> = ({
  edge,
  sourceNode,
  targetNode,
  onEdgeClick,
  onEdgeDoubleClick,
  isEditing,
  onLabelSave,
  onLabelCancel,
  canvasScale = 1,
  onControlPointChange,
  onControlPointDragStart,
}) => {
  const s = anchor(sourceNode, targetNode);
  const t = anchor(targetNode, sourceNode);

  // Hover state — used to show handle even when edge is not selected
  const [isHovered, setIsHovered] = useState(false);

  // Drag state refs (avoid re-renders during drag)
  const isDraggingRef = useRef(false);
  const hasSavedHistoryRef = useRef(false); // single-shot guard: save once per drag
  const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartCPRef = useRef<{ x: number; y: number } | null>(null);
  
  // Check if target is an experiment node - apply special styling
  const isExperimentTarget = targetNode.type === 'experiment';
  
  // For experiment targets: force straight, dashed, grey
  const type = isExperimentTarget ? 'straight' : (edge.type ?? 'bezier');
  
  // Get styling from edge.style with fallbacks to edge.data for backward compatibility
  const style = edge.style || {};
  const strokeColor = isExperimentTarget ? '#9ca3af' : (style.strokeColor || style.stroke || edge.data?.color || '#64748b');
  const strokeWidth = style.strokeWidth ?? edge.data?.strokeWidth ?? 2;
  const strokeOpacity = style.strokeOpacity ?? 1;
  const strokeDasharray = isExperimentTarget ? '8 4' : (style.strokeDasharray || (edge.animated ? '6 4' : undefined));
  const strokeLinecap = style.strokeLinecap || 'butt';
  
  // Determine markers - support both legacy edge.markers and new markerStart/markerEnd
  const hasMarkerStart = edge.markerStart !== undefined ? 
    (edge.markerStart !== false && edge.markerStart !== null) : 
    (edge.markers?.position === 'start' || edge.markers?.position === 'both');
  const hasMarkerEnd = edge.markerEnd !== undefined ? 
    (edge.markerEnd !== false && edge.markerEnd !== null) : 
    (edge.markers?.position !== 'start');
  
  // Get marker config from markerStart/markerEnd or fall back to markers
  const getMarkerConfig = (marker: typeof edge.markerStart | typeof edge.markerEnd): EdgeMarker | undefined => {
    if (marker === undefined || marker === null || marker === false) return undefined;
    if (marker === true) return { type: 'arrow' };
    if (typeof marker === 'object') return marker;
    return undefined;
  };
  
  const markerStartConfig = getMarkerConfig(edge.markerStart) || (hasMarkerStart ? edge.markers : undefined);
  const markerEndConfig = getMarkerConfig(edge.markerEnd) || (hasMarkerEnd ? edge.markers : undefined);
  
  // Generate path — passes the stored controlPoint so the curve bends
  const pathData = generatePath(type, s, t, {
    curvature: edge.curvature,
    cornerRadius: edge.cornerRadius,
    controlPoint: edge.controlPoint,
  });

  // Compute the visible handle position (the circle the user drags).
  // For step/orthogonal with two-segment paths the elbow is the meaningful
  // drag target; for all other types the handle sits on the curve at t=0.5.
  const handlePos = (() => {
    if (!edge.controlPoint) return { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
    const cp = edge.controlPoint;
    const isSourceH = s.direction === 'left' || s.direction === 'right';
    const isTargetH = t.direction === 'left' || t.direction === 'right';
    if ((type === 'step' || type === 'orthogonal') && isSourceH && isTargetH) {
      // elbow column is controlPoint.x; y is at midpoint of source/target
      return { x: cp.x, y: (s.y + t.y) / 2 };
    }
    if ((type === 'step' || type === 'orthogonal') && !isSourceH && !isTargetH) {
      // elbow row is controlPoint.y; x is at midpoint of source/target
      return { x: (s.x + t.x) / 2, y: cp.y };
    }
    // For all other cases, handle is the stored on-curve point
    return cp;
  })();

  // Drag handler — attached to handle circle mousedown
  const handleHandleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onControlPointChange) return;
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    hasSavedHistoryRef.current = false; // reset guard for new drag
    dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
    // Use the computed handlePos as the drag origin so step/orthogonal
    // edges start from the correct elbow position, not the raw stored value
    dragStartCPRef.current = { ...handlePos };

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartScreenRef.current || !dragStartCPRef.current) return;

      // Save history on the first actual movement (single-shot guard)
      if (!hasSavedHistoryRef.current) {
        hasSavedHistoryRef.current = true;
        onControlPointDragStart?.(edge.id);
      }

      const sc = canvasScale || 1;
      const dx = (ev.clientX - dragStartScreenRef.current.x) / sc;
      const dy = (ev.clientY - dragStartScreenRef.current.y) / sc;
      onControlPointChange(edge.id, {
        x: dragStartCPRef.current.x + dx,
        y: dragStartCPRef.current.y + dy,
      });
    };

    const onUp = () => {
      isDraggingRef.current = false;
      hasSavedHistoryRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [edge.id, handlePos.x, handlePos.y, canvasScale, onControlPointChange, onControlPointDragStart]);
  
  // Create unique IDs for gradients and markers
  const edgeId = edge.id;
  const gradientId = `gradient-${edgeId}`;
  const markerId = `marker-${edgeId}`;
  const markerStartId = `marker-start-${edgeId}`;
  const shadowId = `shadow-${edgeId}`;
  const glowId = `glow-${edgeId}`;
  
  // Determine stroke color (gradient or solid)
  let strokeValue = strokeColor;
  if (style.gradient) {
    strokeValue = `url(#${gradientId})`;
  }
  
  // Apply selection styling - no line highlight, only endpoint dots
  const isSelected = edge.selected;

  // Show handle when edge is selected or hovered, and control-point callback is wired up
  const showHandle = (isSelected || isHovered) && !isExperimentTarget && !!onControlPointChange;
  
  return (
    <g 
      className="kiteframe-edge" 
      style={{ zIndex: edge.zIndex || 0 }}
      onClick={(e) => {
        e.stopPropagation();
        onEdgeClick?.(edge);
      }}>
      <defs>
        {/* Gradient definition */}
        {style.gradient && (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {style.gradient.stops.map((stop, index) => (
              <stop 
                key={index}
                offset={stop.offset} 
                stopColor={stop.color} 
                stopOpacity={stop.opacity ?? 1}
              />
            ))}
          </linearGradient>
        )}
        
        {/* Shadow filter */}
        {style.shadow && (
          <filter id={shadowId}>
            <feDropShadow
              dx={style.shadow.offsetX}
              dy={style.shadow.offsetY}
              stdDeviation={style.shadow.blur}
              floodColor={style.shadow.color}
            />
          </filter>
        )}
        
        {/* Glow filter */}
        {style.glow && (
          <filter id={glowId}>
            <feGaussianBlur stdDeviation={style.glow.intensity} result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        )}
        
        {/* Markers - support both legacy markers and markerStart/markerEnd */}
        {hasMarkerEnd && markerEndConfig && createMarker(markerId, markerEndConfig, strokeColor)}
        {hasMarkerStart && markerStartConfig && createMarker(markerStartId, markerStartConfig, strokeColor)}
      </defs>
      
      {/* Invisible wider path for easier clicking + hover detection */}
      <path 
        d={pathData} 
        fill="none" 
        stroke="transparent" 
        strokeWidth={Math.max(strokeWidth + 6, 10)} 
        style={{ 
          cursor: edge.interactable !== false ? 'pointer' : 'default',
          pointerEvents: 'auto' // Only this path captures events
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onEdgeClick?.(edge);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdgeDoubleClick?.(edge);
        }}
      />
      
      {/* Main edge path */}
      <path 
        d={pathData} 
        fill={style.fill || "none"} 
        stroke={strokeValue} 
        strokeWidth={strokeWidth} 
        strokeOpacity={strokeOpacity}
        strokeDasharray={strokeDasharray}
        strokeLinecap={strokeLinecap}
        className={edge.animated ? 'kiteframe-edge-animated' : ''}
        markerStart={hasMarkerStart ? `url(#${markerStartId})` : undefined}
        markerEnd={hasMarkerEnd ? `url(#${markerId})` : undefined}
        filter={style.shadow ? `url(#${shadowId})` : style.glow ? `url(#${glowId})` : undefined}
        style={{ 
          cursor: edge.interactable !== false ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          pointerEvents: 'none' // Let the invisible path handle clicks
        }}
      />
      
      {/* Selection endpoint dots */}
      {isSelected && (
        <>
          <circle
            cx={s.x}
            cy={s.y}
            r={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={t.x}
            cy={t.y}
            r={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}

      {/* Control-point handle — drag to reshape, double-click to reset */}
      {showHandle && (
        <circle
          cx={handlePos.x}
          cy={handlePos.y}
          r={5}
          fill={edge.controlPoint ? '#3b82f6' : 'rgba(59,130,246,0.45)'}
          stroke="#ffffff"
          strokeWidth={2}
          style={{ cursor: 'grab', pointerEvents: 'all' }}
          onMouseDown={handleHandleMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // Reset edge to automatic shape
            onControlPointChange!(edge.id, null);
          }}
        />
      )}
      
      {/* Edge label with enhanced styling - Phase 4: Hide {needs-label} sentinel */}
      {(() => {
        const displayLabel = getDisplayLabel(edge.label);
        const shouldShowLabel = displayLabel || isEditing;
        if (!shouldShowLabel) return null;
        
        return (
          <g 
            style={{ zIndex: 100, cursor: 'pointer' }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEdgeDoubleClick?.(edge);
            }}
          >
            {isEditing ? (
              <EdgeLabelEditor
                edge={edge}
                x={(s.x + t.x) / 2}
                y={(s.y + t.y) / 2}
                strokeColor={strokeColor}
                backgroundColor={sourceNode.data?.colors?.bodyBackground || edge.labelStyle?.backgroundColor || '#ffffff'}
                textColor={sourceNode.data?.colors?.bodyTextColor || edge.labelStyle?.fontColor || '#64748b'}
                onSave={(newLabel) => onLabelSave?.(edge.id, newLabel)}
                onCancel={() => onLabelCancel?.()}
              />
            ) : displayLabel && (
              <>
                {/* Label background with source node body color and edge-colored border */}
                <rect
                  x={(s.x + t.x) / 2 - (displayLabel.length * 4 + 6)}
                  y={(s.y + t.y) / 2 - 10}
                  width={displayLabel.length * 8 + 12}
                  height={20}
                  fill={sourceNode.data?.colors?.bodyBackground || edge.labelStyle?.backgroundColor || '#ffffff'}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  rx={edge.labelStyle?.borderRadius || 4}
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))', pointerEvents: 'auto' }}
                />
                <text 
                  x={(s.x + t.x) / 2} 
                  y={(s.y + t.y) / 2} 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                  fontSize={edge.labelStyle?.fontSize || 11}
                  fill={sourceNode.data?.colors?.bodyTextColor || edge.labelStyle?.fontColor || '#64748b'}
                  fontWeight={edge.labelStyle?.fontWeight || '500'}
                  style={{ userSelect: 'none', pointerEvents: 'auto' }}
                >
                  {displayLabel}
                </text>
              </>
            )}
          </g>
        );
      })()}
    </g>
  );
};
