import React from 'react';
import type { Edge, Node, EdgeStyle, EdgeMarker } from '../types';

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
  const { curvature = 0.5, cornerRadius = 10 } = options;
  
  // Round source and target coordinates for pixel-perfect rendering
  const sx = r(s.x), sy = r(s.y);
  const tx = r(t.x), ty = r(t.y);
  
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
        // Both horizontal: go horizontal first, then vertical
        const mx = r(sx + (tx - sx) / 2);
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - mx) / 2, Math.abs(ty - sy) / 2);
          const dx = tx > mx ? 1 : -1;
          const dy = ty > sy ? 1 : -1;
          return `M ${sx} ${sy} L ${r(mx - rad * dx)} ${sy} Q ${mx} ${sy} ${mx} ${r(sy + rad * dy)} L ${mx} ${r(ty - rad * dy)} Q ${mx} ${ty} ${r(mx + rad * dx)} ${ty} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else if (!isSourceHorizontal && !isTargetHorizontal) {
        // Both vertical: go vertical first, then horizontal
        const my = r(sy + (ty - sy) / 2);
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(ty - my) / 2, Math.abs(tx - sx) / 2);
          const dx = tx > sx ? 1 : -1;
          const dy = ty > my ? 1 : -1;
          return `M ${sx} ${sy} L ${sx} ${r(my - rad * dy)} Q ${sx} ${my} ${r(sx + rad * dx)} ${my} L ${r(tx - rad * dx)} ${my} Q ${tx} ${my} ${tx} ${r(my + rad * dy)} L ${tx} ${ty}`;
        }
        return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      } else {
        // Mixed: go in source direction first
        if (cornerRadius > 0) {
          const rad = Math.min(cornerRadius, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2);
          if (isSourceHorizontal) {
            const dx = tx > sx ? 1 : -1;
            const dy = ty > sy ? 1 : -1;
            return `M ${sx} ${sy} L ${r(tx - rad * dx)} ${sy} Q ${tx} ${sy} ${tx} ${r(sy + rad * dy)} L ${tx} ${ty}`;
          } else {
            const dx = tx > sx ? 1 : -1;
            const dy = ty > sy ? 1 : -1;
            return `M ${sx} ${sy} L ${sx} ${r(ty - rad * dy)} Q ${sx} ${ty} ${r(sx + rad * dx)} ${ty} L ${tx} ${ty}`;
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
        // Both horizontal: go horizontal, then vertical, then horizontal
        const mx = r((sx + tx) / 2);
        return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else if (!isSourceHorizontal && !isTargetHorizontal) {
        // Both vertical: go vertical, then horizontal, then vertical
        const my = r((sy + ty) / 2);
        return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      } else if (isSourceHorizontal && !isTargetHorizontal) {
        // Source horizontal, target vertical: horizontal then vertical
        return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      } else {
        // Source vertical, target horizontal: vertical then horizontal
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

export const ConnectionEdge: React.FC<{ 
  edge: Edge; 
  sourceNode: Node; 
  targetNode: Node;
  onEdgeClick?: (edge: Edge) => void;
}> = ({ edge, sourceNode, targetNode, onEdgeClick }) => {
  const s = anchor(sourceNode, targetNode);
  const t = anchor(targetNode, sourceNode);
  const type = edge.type ?? 'bezier';
  
  // Get styling from edge.style with fallbacks to edge.data for backward compatibility
  const style = edge.style || {};
  const strokeColor = style.strokeColor || style.stroke || edge.data?.color || '#64748b';
  const strokeWidth = style.strokeWidth ?? edge.data?.strokeWidth ?? 2;
  const strokeOpacity = style.strokeOpacity ?? 1;
  const strokeDasharray = style.strokeDasharray || (edge.animated ? '6 4' : undefined);
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
  
  // Generate path based on edge type
  const pathData = generatePath(type, s, t, {
    curvature: edge.curvature,
    cornerRadius: edge.cornerRadius
  });
  
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
      
      {/* Invisible wider path for easier clicking */}
      <path 
        d={pathData} 
        fill="none" 
        stroke="transparent" 
        strokeWidth={Math.max(strokeWidth + 6, 10)} 
        style={{ 
          cursor: edge.interactable !== false ? 'pointer' : 'default',
          pointerEvents: 'auto' // Only this path captures events
        }}
        onClick={(e) => {
          e.stopPropagation();
          onEdgeClick?.(edge);
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
      
      {/* Edge label with enhanced styling */}
      {edge.label && (
        <g style={{ zIndex: 100 }}>
          {/* Label background with source node body color and edge-colored border */}
          <rect
            x={(s.x + t.x) / 2 - (edge.label.length * 4 + 6)}
            y={(s.y + t.y) / 2 - 10}
            width={edge.label.length * 8 + 12}
            height={20}
            fill={sourceNode.data?.colors?.bodyBackground || edge.labelStyle?.backgroundColor || '#ffffff'}
            stroke={strokeColor}
            strokeWidth={1.5}
            rx={edge.labelStyle?.borderRadius || 4}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
          />
          <text 
            x={(s.x + t.x) / 2} 
            y={(s.y + t.y) / 2} 
            textAnchor="middle" 
            dominantBaseline="middle"
            fontSize={edge.labelStyle?.fontSize || 11}
            fill={sourceNode.data?.colors?.bodyTextColor || edge.labelStyle?.fontColor || '#64748b'}
            fontWeight={edge.labelStyle?.fontWeight || '500'}
            style={{ userSelect: 'none' }}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
};