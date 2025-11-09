import React from 'react';
import type { Edge, Node, EdgeStyle, EdgeMarker } from '../types';

function anchor(node: Node, toward: Node){
  const w = node.style?.width ?? node.width ?? 200;
  const h = node.style?.height ?? node.height ?? 100;
  const x = node.position.x, y = node.position.y;
  const cx = x + w/2, cy = y + h/2;
  const tw = toward.style?.width ?? toward.width ?? 200;
  const th = toward.style?.height ?? toward.height ?? 100;
  const tcx = toward.position.x + tw/2, tcy = toward.position.y + th/2;
  const dx = tcx - cx, dy = tcy - cy;
  const angle = Math.atan2(dy, dx);
  const ha = Math.abs(angle) < Math.PI/4 || Math.abs(angle) > 3*Math.PI/4;
  
  // Match handle positioning by adding handleOffset/2 (4px) to align with handle locations
  const handleOffset = 4;
  
  if (ha) return dx > 0 ? { x: x + w + handleOffset, y: cy } : { x: x - handleOffset, y: cy };
  return dy > 0 ? { x: cx, y: y + h + handleOffset } : { x: cx, y: y - handleOffset };
}

// Helper function to round coordinates for crisp rendering
const r = (n: number) => Math.round(n);

// Helper function to generate path based on edge type
function generatePath(type: string, s: { x: number; y: number }, t: { x: number; y: number }, options: any = {}) {
  const { curvature = 0.5, cornerRadius = 10 } = options;
  
  // Round source and target coordinates for pixel-perfect rendering
  const sx = r(s.x), sy = r(s.y);
  const tx = r(t.x), ty = r(t.y);
  
  switch (type) {
    case 'straight':
      return `M ${sx} ${sy} L ${tx} ${ty}`;
      
    case 'step':
      const mx = r(sx + (tx - sx) / 2);
      if (cornerRadius > 0) {
        // Rounded step edge
        const rad = Math.min(cornerRadius, Math.abs(tx - mx) / 2, Math.abs(ty - sy) / 2);
        const dx = tx > mx ? 1 : -1;
        const dy = ty > sy ? 1 : -1;
        return `M ${sx} ${sy} L ${r(mx - rad * dx)} ${sy} Q ${mx} ${sy} ${mx} ${r(sy + rad * dy)} L ${mx} ${r(ty - rad * dy)} Q ${mx} ${ty} ${r(mx + rad * dx)} ${ty} L ${tx} ${ty}`;
      }
      return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      
    case 'smoothstep':
      const smx = r(sx + (tx - sx) / 2);
      const curve = r(Math.abs(ty - sy) * 0.3);
      return `M ${sx} ${sy} C ${r(sx + curve)} ${sy}, ${r(smx - curve)} ${sy}, ${smx} ${sy} L ${smx} ${ty} C ${r(smx + curve)} ${ty}, ${r(tx - curve)} ${ty}, ${tx} ${ty}`;
      
    case 'curved':
      const distance = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));
      const offset = distance * curvature * 0.5;
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const angle = Math.atan2(ty - sy, tx - sx) + Math.PI / 2;
      const cx = r(midX + Math.cos(angle) * offset);
      const cy = r(midY + Math.sin(angle) * offset);
      return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
      
    case 'orthogonal':
      const isHorizontalFirst = Math.abs(tx - sx) > Math.abs(ty - sy);
      if (isHorizontalFirst) {
        return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      } else {
        return `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
      }
      
    default: // bezier
      const c1x = r(sx + (tx - sx) * 0.5);
      const c1y = sy;
      const c2x = r(tx - (tx - sx) * 0.5);
      const c2y = ty;
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
  const strokeColor = style.strokeColor || edge.data?.color || '#64748b';
  const strokeWidth = style.strokeWidth ?? edge.data?.strokeWidth ?? 2;
  const strokeOpacity = style.strokeOpacity ?? 1;
  const strokeDasharray = style.strokeDasharray || (edge.animated ? '6 4' : undefined);
  
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
  
  // Apply selection styling
  const isSelected = edge.selected;
  const selectionStroke = isSelected ? '#3b82f6' : strokeValue;
  const selectionWidth = isSelected ? strokeWidth + 1 : strokeWidth;
  
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
        
        {/* Markers */}
        {edge.markers?.position !== 'start' && createMarker(markerId, edge.markers, strokeColor)}
        {edge.markers?.position === 'both' && createMarker(markerStartId, edge.markers, strokeColor)}
      </defs>
      
      {/* Selection outline */}
      {isSelected && (
        <path 
          d={pathData} 
          fill="none" 
          stroke="#3b82f6" 
          strokeWidth={selectionWidth + 2} 
          strokeOpacity={0.3}
          pointerEvents="none"
        />
      )}
      
      {/* Invisible wider path for easier clicking */}
      <path 
        d={pathData} 
        fill="none" 
        stroke="transparent" 
        strokeWidth={Math.max(selectionWidth + 6, 10)} 
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
        stroke={selectionStroke} 
        strokeWidth={selectionWidth} 
        strokeOpacity={strokeOpacity}
        strokeDasharray={strokeDasharray}
        className={edge.animated ? 'kiteframe-edge-animated' : ''}
        markerStart={edge.markers?.position === 'start' || edge.markers?.position === 'both' ? `url(#${markerStartId})` : undefined}
        markerEnd={edge.markers?.position !== 'start' ? `url(#${markerId})` : undefined}
        filter={style.shadow ? `url(#${shadowId})` : style.glow ? `url(#${glowId})` : undefined}
        style={{ 
          cursor: edge.interactable !== false ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          pointerEvents: 'none' // Let the invisible path handle clicks
        }}
      />
      
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