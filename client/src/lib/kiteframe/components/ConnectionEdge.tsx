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

function anchor(node: Node, toward: Node, towardPoint?: { x: number; y: number }): AnchorResult {
  // Use measuredWidth/measuredHeight (transient DOM measurements) if available, for accurate edge tracking
  const w = node.measuredWidth ?? node.style?.width ?? node.width ?? 200;
  const h = node.measuredHeight ?? node.style?.height ?? node.height ?? 100;
  const x = node.position.x, y = node.position.y;
  const cx = x + w/2, cy = y + h/2;
  // By default the connection side is chosen toward the other node's center.
  // When a `towardPoint` is supplied (e.g. a step edge's dragged bend), choose
  // the side toward that point instead, so the line leaves from the side that
  // matches the bend rather than always toward the other node.
  let tcx: number, tcy: number;
  if (towardPoint) {
    tcx = towardPoint.x;
    tcy = towardPoint.y;
  } else {
    const tw = toward.measuredWidth ?? toward.style?.width ?? toward.width ?? 200;
    const th = toward.measuredHeight ?? toward.style?.height ?? toward.height ?? 100;
    tcx = toward.position.x + tw/2;
    tcy = toward.position.y + th/2;
  }
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
  // curve at t=0.5, so we back-calculate the true Q control point:
  //   cp = 2·stored − (S+T)/2
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
      const isSourceHorizontal = s.direction === 'left' || s.direction === 'right';
      const isTargetHorizontal = t.direction === 'left' || t.direction === 'right';
      
      if (isSourceHorizontal && isTargetHorizontal) {
        // Both horizontal: controlPoint.x sets the elbow column
        const mx = controlPoint ? r(controlPoint.x) : r(sx + (tx - sx) / 2);
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - mx) / 2, Math.abs(ty - sy) / 2);
          const ddx = tx > mx ? 1 : -1;
          const ddy = ty > sy ? 1 : -1;
          return `M ${sx} ${sy} L ${r(mx - rad * ddx)} ${sy} Q ${mx} ${sy} ${mx} ${r(sy + rad * ddy)} L ${mx} ${r(ty - rad * ddy)} Q ${mx} ${ty} ${r(mx + rad * ddx)} ${ty} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else if (!isSourceHorizontal && !isTargetHorizontal) {
        // Both vertical: controlPoint.y sets the elbow row
        const my = controlPoint ? r(controlPoint.y) : r(sy + (ty - sy) / 2);
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(ty - my) / 2, Math.abs(tx - sx) / 2);
          const ddx = tx > sx ? 1 : -1;
          const ddy = ty > my ? 1 : -1;
          return `M ${sx} ${sy} L ${sx} ${r(my - rad * ddy)} Q ${sx} ${my} ${r(sx + rad * ddx)} ${my} L ${r(tx - rad * ddx)} ${my} Q ${tx} ${my} ${tx} ${r(my + rad * ddy)} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      } else if (isSourceHorizontal) {
        // Source horizontal, target vertical.
        // With controlPoint, use controlPoint.x as an intermediate column so the
        // path stays step-shaped (3-segment).  Without it, single right-angle corner.
        if (controlPoint) {
          const mx = r(controlPoint.x);
          return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
        }
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2);
          const ddx = tx > sx ? 1 : -1;
          const ddy = ty > sy ? 1 : -1;
          return `M ${sx} ${sy} L ${r(tx - rad * ddx)} ${sy} Q ${tx} ${sy} ${tx} ${r(sy + rad * ddy)} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      } else {
        // Source vertical, target horizontal.
        // With controlPoint, use controlPoint.y as an intermediate row.
        if (controlPoint) {
          const my = r(controlPoint.y);
          return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
        }
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2);
          const ddx = tx > sx ? 1 : -1;
          const ddy = ty > sy ? 1 : -1;
          return `M ${sx} ${sy} L ${sx} ${r(ty - rad * ddy)} Q ${sx} ${ty} ${r(sx + rad * ddx)} ${ty} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
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
      const isSourceHorizontal = s.direction === 'left' || s.direction === 'right';
      const isTargetHorizontal = t.direction === 'left' || t.direction === 'right';
      
      if (isSourceHorizontal && isTargetHorizontal) {
        // Both horizontal: controlPoint.x sets the elbow column
        const mx = controlPoint ? r(controlPoint.x) : r((sx + tx) / 2);
        return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else if (!isSourceHorizontal && !isTargetHorizontal) {
        // Both vertical: controlPoint.y sets the elbow row
        const my = controlPoint ? r(controlPoint.y) : r((sy + ty) / 2);
        return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      } else if (isSourceHorizontal) {
        // Source horizontal, target vertical.
        // With controlPoint, use controlPoint.x as intermediate column.
        if (controlPoint) {
          const mx = r(controlPoint.x);
          return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      } else {
        // Source vertical, target horizontal.
        // With controlPoint, use controlPoint.y as intermediate row.
        if (controlPoint) {
          const my = r(controlPoint.y);
          return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
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

// Build an SVG path string from an ordered list of corner points, rounding each
// interior corner by up to `radius` (clamped to half the shorter adjacent segment).
// Works for any orthogonal polyline (the multi-waypoint step/orthogonal router).
function buildRoundedOrthPath(corners: { x: number; y: number }[], radius: number): string {
  if (corners.length === 0) return '';
  if (corners.length === 1) return `M ${corners[0].x} ${corners[0].y}`;
  let d = `M ${corners[0].x} ${corners[0].y}`;
  for (let i = 1; i < corners.length - 1; i++) {
    const prev = corners[i - 1];
    const cur = corners[i];
    const next = corners[i + 1];
    const len1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const len2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rad = Math.min(radius, len1 / 2, len2 / 2);
    if (rad <= 0 || len1 === 0 || len2 === 0) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const p1 = { x: cur.x + ((prev.x - cur.x) / len1) * rad, y: cur.y + ((prev.y - cur.y) / len1) * rad };
    const p2 = { x: cur.x + ((next.x - cur.x) / len2) * rad, y: cur.y + ((next.y - cur.y) / len2) * rad };
    d += ` L ${r(p1.x)} ${r(p1.y)} Q ${cur.x} ${cur.y} ${r(p2.x)} ${r(p2.y)}`;
  }
  const last = corners[corners.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// Expand a source anchor, an ordered list of user waypoints, and a target anchor
// into a fully axis-aligned (orthogonal) list of corner points. Each user waypoint
// is kept as a point the line passes through; when two consecutive points are not
// already aligned, an L-shaped connector inserts one extra corner so every segment
// stays horizontal or vertical. The starting orientation follows the source side,
// then alternates to produce a clean staircase.
function routeOrthogonalWaypoints(
  s: AnchorResult,
  t: AnchorResult,
  waypoints: { x: number; y: number }[],
): { x: number; y: number }[] {
  const pts = [
    { x: r(s.x), y: r(s.y) },
    ...waypoints.map((w) => ({ x: r(w.x), y: r(w.y) })),
    { x: r(t.x), y: r(t.y) },
  ];
  const corners: { x: number; y: number }[] = [pts[0]];
  let horizontalFirst = s.direction === 'left' || s.direction === 'right';
  for (let i = 1; i < pts.length; i++) {
    const prev = corners[corners.length - 1];
    const cur = pts[i];
    if (prev.x === cur.x || prev.y === cur.y) {
      // Already aligned on one axis — a single straight segment.
      if (prev.x !== cur.x || prev.y !== cur.y) corners.push(cur);
    } else if (horizontalFirst) {
      corners.push({ x: cur.x, y: prev.y }); // go horizontal, then vertical
      corners.push(cur);
    } else {
      corners.push({ x: prev.x, y: cur.y }); // go vertical, then horizontal
      corners.push(cur);
    }
    // Seed next leg's orientation from how this leg ended: arrive vertical -> leave
    // horizontal, and vice versa, so corners never double back.
    const a = corners[corners.length - 2];
    const b = corners[corners.length - 1];
    if (a && b && (a.x !== b.x || a.y !== b.y)) {
      horizontalFirst = a.x === b.x; // last segment vertical -> next leaves horizontal
    }
  }
  return corners;
}

// Point at the halfway mark along a polyline (by accumulated length). Used to place
// the "+" insert affordance exactly on the rendered staircase, not on a straight chord.
function polylineMidpoint(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  let target = total / 2;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (seg >= target) {
      const f = seg === 0 ? 0 : target / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * f,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * f,
      };
    }
    target -= seg;
  }
  return points[points.length - 1];
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
  onWaypointsChange?: (edgeId: string, waypoints: { x: number; y: number }[] | null) => void;
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
  onWaypointsChange,
}) => {
  // isHovered tracks whether pointer is over the edge path OR the handle circle.
  // React 18 automatic batching ensures that path-mouseLeave + handle-mouseEnter
  // fired in the same browser task collapse into a single render (net: still true).
  const [isHovered, setIsHovered] = useState(false);

  // Drag state refs — no re-render needed while dragging
  const isDraggingRef = useRef(false);
  const hasSavedHistoryRef = useRef(false); // single-shot guard: save once per drag
  const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartCPRef = useRef<{ x: number; y: number } | null>(null);
  
  // Check if target is an experiment node - apply special styling
  const isExperimentTarget = targetNode.type === 'experiment';
  
  // For experiment targets: force straight, dashed, grey
  const type = isExperimentTarget ? 'straight' : (edge.type ?? 'bezier');

  const isStepLike = type === 'step' || type === 'orthogonal';

  // Effective bend points. Prefer the multi-waypoint list; fall back to the legacy
  // single controlPoint so existing edges keep working unchanged. Only step/orthogonal
  // edges support multiple waypoints — other types keep their single controlPoint.
  const effectiveWaypoints: { x: number; y: number }[] = isStepLike
    ? (edge.waypoints && edge.waypoints.length > 0
        ? edge.waypoints
        : (edge.controlPoint ? [edge.controlPoint] : []))
    : (edge.controlPoint ? [edge.controlPoint] : []);
  // "Multi" routing only kicks in once there are 2+ bends; a single bend renders
  // identically to the legacy controlPoint path.
  const isMulti = isStepLike && effectiveWaypoints.length >= 2;
  const singleCp = !isMulti ? (effectiveWaypoints[0] ?? undefined) : undefined;

  // Choose each node's connection side. For step/orthogonal edges with bends,
  // point the source toward the first bend and the target toward the last bend so
  // the right-angle line doesn't double back. All other edge types keep the
  // center-to-center choice.
  const sourceTowardPoint = isStepLike && effectiveWaypoints.length > 0 ? effectiveWaypoints[0] : undefined;
  const targetTowardPoint = isStepLike && effectiveWaypoints.length > 0 ? effectiveWaypoints[effectiveWaypoints.length - 1] : undefined;
  const s = anchor(sourceNode, targetNode, sourceTowardPoint);
  const t = anchor(targetNode, sourceNode, targetTowardPoint);
  
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
  
  // Generate path. With 2+ bends, route an orthogonal staircase through every
  // waypoint; otherwise use the legacy single-controlPoint path (identical render).
  const pathData = isMulti
    ? buildRoundedOrthPath(
        routeOrthogonalWaypoints(s, t, effectiveWaypoints),
        edge.cornerRadius ?? 10,
      )
    : generatePath(type, s, t, {
        curvature: edge.curvature,
        cornerRadius: edge.cornerRadius,
        controlPoint: singleCp,
      });

  // Compute the visible single-bend handle position (used when there are 0–1 bends).
  // - step/orthogonal both-H  : handle sits at (controlPoint.x, midY) — elbow column
  // - step/orthogonal both-V  : handle sits at (midX, controlPoint.y) — elbow row
  // - step/orthogonal mixed-H : handle at (controlPoint.x, midY) — intermediate column
  // - step/orthogonal mixed-V : handle at (midX, controlPoint.y) — intermediate row
  // - all other types         : handle is the stored on-curve point at t=0.5
  const handlePos = (() => {
    const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
    const cp = singleCp;
    if (!cp) return mid;
    const isSourceH = s.direction === 'left' || s.direction === 'right';
    if (type === 'step' || type === 'orthogonal') {
      // Horizontal-first paths: drag moves the elbow/intermediate column (X)
      if (isSourceH) return { x: cp.x, y: mid.y };
      // Vertical-first paths: drag moves the elbow/intermediate row (Y)
      return { x: mid.x, y: cp.y };
    }
    return cp;
  })();

  // Drag handler — attached to handle circle pointerdown (mouse, touch, or pen)
  const handleHandlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onControlPointChange) return;
    if (e.button != null && e.button !== 0) return; // primary button / touch / pen only
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    try { (e.currentTarget as Element).setPointerCapture(pointerId); } catch { /* already released */ }

    isDraggingRef.current = true;
    hasSavedHistoryRef.current = false; // reset guard for new drag
    dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
    // Start from the computed handlePos so step/orthogonal edges use the correct axis
    dragStartCPRef.current = { ...handlePos };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!isDraggingRef.current || !dragStartScreenRef.current || !dragStartCPRef.current) return;

      // Save history snapshot on the FIRST actual movement (single-shot guard).
      // This avoids creating no-op history entries when user clicks without dragging.
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

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      isDraggingRef.current = false;
      hasSavedHistoryRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [edge.id, handlePos.x, handlePos.y, canvasScale, onControlPointChange, onControlPointDragStart]);

  const MAX_WAYPOINTS = 10;

  // The bend points shown as handles. In multi mode these are the raw stored
  // points; with a single bend it's the visible handle position so inserting a
  // second bend seeds from where the user sees the elbow.
  const visualWaypoints: { x: number; y: number }[] = isMulti
    ? effectiveWaypoints
    : (singleCp ? [handlePos] : []);

  // Move an existing waypoint (multi mode). Snapshots history once on first move,
  // then writes the whole updated waypoint list.
  const startWaypointDrag = useCallback((e: React.PointerEvent, index: number) => {
    if (!onWaypointsChange) return;
    if (e.button != null && e.button !== 0) return; // primary button / touch / pen only
    e.preventDefault();
    e.stopPropagation();
    const pointerId = e.pointerId;
    try { (e.currentTarget as Element).setPointerCapture(pointerId); } catch { /* already released */ }
    const base = effectiveWaypoints.map((w) => ({ ...w }));
    const start = base[index];
    if (!start) return;
    const startScreen = { x: e.clientX, y: e.clientY };
    let saved = false;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!saved) {
        saved = true;
        onControlPointDragStart?.(edge.id);
      }
      const sc = canvasScale || 1;
      const dx = (ev.clientX - startScreen.x) / sc;
      const dy = (ev.clientY - startScreen.y) / sc;
      const next = base.map((w) => ({ ...w }));
      next[index] = { x: start.x + dx, y: start.y + dy };
      onWaypointsChange(edge.id, next);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [edge.id, effectiveWaypoints, canvasScale, onWaypointsChange, onControlPointDragStart]);

  // Insert a new bend at segment `segIndex` (0 = source→first), then immediately
  // start dragging it so a click-drag pulls out a fresh bend.
  const startInsertDrag = useCallback((e: React.PointerEvent, segIndex: number, at: { x: number; y: number }) => {
    if (!onWaypointsChange) return;
    if (e.button != null && e.button !== 0) return; // primary button / touch / pen only
    e.preventDefault();
    e.stopPropagation();
    if (visualWaypoints.length >= MAX_WAYPOINTS) return;
    const pointerId = e.pointerId;
    try { (e.currentTarget as Element).setPointerCapture(pointerId); } catch { /* already released */ }
    // Commit the insert right away (one history entry) so a plain click adds a bend.
    onControlPointDragStart?.(edge.id);
    const base = visualWaypoints.map((w) => ({ ...w }));
    base.splice(segIndex, 0, { x: at.x, y: at.y });
    onWaypointsChange(edge.id, base);
    // Then drag the freshly inserted point (index === segIndex).
    const start = { x: at.x, y: at.y };
    const startScreen = { x: e.clientX, y: e.clientY };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const sc = canvasScale || 1;
      const dx = (ev.clientX - startScreen.x) / sc;
      const dy = (ev.clientY - startScreen.y) / sc;
      const next = base.map((w) => ({ ...w }));
      next[segIndex] = { x: start.x + dx, y: start.y + dy };
      onWaypointsChange(edge.id, next);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [edge.id, visualWaypoints, canvasScale, onWaypointsChange, onControlPointDragStart]);

  // Remove a bend (double-click a waypoint handle in multi mode).
  const deleteWaypoint = useCallback((index: number) => {
    if (!onWaypointsChange) return;
    onControlPointDragStart?.(edge.id);
    const next = effectiveWaypoints.filter((_, i) => i !== index);
    onWaypointsChange(edge.id, next.length > 0 ? next : null);
  }, [edge.id, effectiveWaypoints, onWaypointsChange, onControlPointDragStart]);

  // "+" insert affordances, one per logical segment (source → wp1 → ... → wpN →
  // target). Each marker sits on the midpoint of the ACTUAL routed orthogonal
  // sub-path for that segment (not the straight chord), so it always lands on the
  // rendered line. Index i means "insert a new bend at waypoint position i".
  const insertSlots = (() => {
    const logical = [
      { x: r(s.x), y: r(s.y) },
      ...visualWaypoints.map((w) => ({ x: r(w.x), y: r(w.y) })),
      { x: r(t.x), y: r(t.y) },
    ];
    const routed = routeOrthogonalWaypoints(s, t, visualWaypoints);
    // Locate each logical point within the routed corner list (they appear in order).
    const logicalIdx: number[] = [];
    let cursor = 0;
    for (const lp of logical) {
      let found = -1;
      for (let j = cursor; j < routed.length; j++) {
        if (routed[j].x === lp.x && routed[j].y === lp.y) { found = j; break; }
      }
      if (found === -1) found = Math.min(cursor, routed.length - 1);
      logicalIdx.push(found);
      cursor = found;
    }
    const slots: { x: number; y: number; index: number }[] = [];
    for (let i = 0; i < logical.length - 1; i++) {
      const sub = routed.slice(logicalIdx[i], logicalIdx[i + 1] + 1);
      const mid = sub.length >= 2
        ? polylineMidpoint(sub)
        : { x: (logical[i].x + logical[i + 1].x) / 2, y: (logical[i].y + logical[i + 1].y) / 2 };
      slots.push({ x: mid.x, y: mid.y, index: i });
    }
    return slots;
  })();

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
  const handlesVisible = (isSelected || isHovered) && !isExperimentTarget;
  // Single-bend handle (0–1 bends): the legacy elbow/control-point handle.
  const showHandle = !isMulti && handlesVisible && !!onControlPointChange;
  // Per-waypoint handles (2+ bends).
  const showWaypointHandles = isMulti && handlesVisible && !!onWaypointsChange;
  // "+" insert affordances appear only while selected, for step/orthogonal edges.
  const showInsertSlots =
    isStepLike && isSelected && !isExperimentTarget && !!onWaypointsChange && visualWaypoints.length < MAX_WAYPOINTS;
  
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

      {/* Control-point handle — drag to reshape, double-click to reset.
          onMouseEnter/Leave are mirrored on the handle so that moving the pointer
          from the invisible edge path to the circle does not flash the handle away
          (React 18 batches the simultaneous Leave+Enter into a single render). */}
      {showHandle && (
        <circle
          cx={handlePos.x}
          cy={handlePos.y}
          r={5}
          fill={singleCp ? '#3b82f6' : 'rgba(59,130,246,0.45)'}
          stroke="#ffffff"
          strokeWidth={2}
          style={{ cursor: 'grab', pointerEvents: 'all', touchAction: 'none' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onPointerDown={handleHandlePointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // Reset edge to automatic shape
            onControlPointChange!(edge.id, null);
          }}
        />
      )}

      {/* Per-waypoint bend handles (2+ bends): drag to move, double-click to remove. */}
      {showWaypointHandles && effectiveWaypoints.map((wp, i) => (
        <circle
          key={`wp-${i}`}
          cx={r(wp.x)}
          cy={r(wp.y)}
          r={5}
          fill="#3b82f6"
          stroke="#ffffff"
          strokeWidth={2}
          style={{ cursor: 'grab', pointerEvents: 'all', touchAction: 'none' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onPointerDown={(e) => startWaypointDrag(e, i)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            deleteWaypoint(i);
          }}
        >
          <title>Drag to move this bend · double-click to remove</title>
        </circle>
      ))}

      {/* "+" insert affordances at each segment midpoint: click or drag to add a bend. */}
      {showInsertSlots && insertSlots.map((slot) => (
        <g
          key={`ins-${slot.index}`}
          style={{ cursor: 'copy', pointerEvents: 'all', touchAction: 'none' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onPointerDown={(e) => startInsertDrag(e, slot.index, { x: slot.x, y: slot.y })}
        >
          <title>Add a bend here</title>
          <circle
            cx={r(slot.x)}
            cy={r(slot.y)}
            r={6}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={1.5}
            opacity={0.9}
          />
          <line x1={r(slot.x) - 3} y1={r(slot.y)} x2={r(slot.x) + 3} y2={r(slot.y)} stroke="#3b82f6" strokeWidth={1.5} />
          <line x1={r(slot.x)} y1={r(slot.y) - 3} x2={r(slot.x)} y2={r(slot.y) + 3} stroke="#3b82f6" strokeWidth={1.5} />
        </g>
      ))}
      
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
