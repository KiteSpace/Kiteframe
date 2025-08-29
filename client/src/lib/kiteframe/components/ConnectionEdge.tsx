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
  if (ha) return dx > 0 ? { x: x + w, y: cy } : { x, y: cy };
  return dy > 0 ? { x: cx, y: y + h } : { x: cx, y };
}

// Helper function to generate path based on edge type
function generatePath(type: string, s: { x: number; y: number }, t: { x: number; y: number }, options: any = {}) {
  const { curvature = 0.5, cornerRadius = 10 } = options;
  
  switch (type) {
    case 'straight':
      return `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
      
    case 'step':
      const mx = s.x + (t.x - s.x) / 2;
      if (cornerRadius > 0) {
        // Rounded step edge
        const r = Math.min(cornerRadius, Math.abs(t.x - mx) / 2, Math.abs(t.y - s.y) / 2);
        const dx = t.x > mx ? 1 : -1;
        const dy = t.y > s.y ? 1 : -1;
        return `M ${s.x} ${s.y} L ${mx - r * dx} ${s.y} Q ${mx} ${s.y} ${mx} ${s.y + r * dy} L ${mx} ${t.y - r * dy} Q ${mx} ${t.y} ${mx + r * dx} ${t.y} L ${t.x} ${t.y}`;
      }
      return `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${t.y} L ${t.x} ${t.y}`;
      
    case 'smoothstep':
      const smx = s.x + (t.x - s.x) / 2;
      const curve = Math.abs(t.y - s.y) * 0.3;
      return `M ${s.x} ${s.y} C ${s.x + curve} ${s.y}, ${smx - curve} ${s.y}, ${smx} ${s.y} L ${smx} ${t.y} C ${smx + curve} ${t.y}, ${t.x - curve} ${t.y}, ${t.x} ${t.y}`;
      
    case 'curved':
      const distance = Math.sqrt(Math.pow(t.x - s.x, 2) + Math.pow(t.y - s.y, 2));
      const offset = distance * curvature * 0.5;
      const midX = (s.x + t.x) / 2;
      const midY = (s.y + t.y) / 2;
      const angle = Math.atan2(t.y - s.y, t.x - s.x) + Math.PI / 2;
      const cx = midX + Math.cos(angle) * offset;
      const cy = midY + Math.sin(angle) * offset;
      return `M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`;
      
    case 'orthogonal':
      const isHorizontalFirst = Math.abs(t.x - s.x) > Math.abs(t.y - s.y);
      if (isHorizontalFirst) {
        return `M ${s.x} ${s.y} L ${t.x} ${s.y} L ${t.x} ${t.y}`;
      } else {
        return `M ${s.x} ${s.y} L ${s.x} ${t.y} L ${t.x} ${t.y}`;
      }
      
    default: // bezier
      const c1x = s.x + (t.x - s.x) * 0.5;
      const c1y = s.y;
      const c2x = t.x - (t.x - s.x) * 0.5;
      const c2y = t.y;
      return `M ${s.x} ${s.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${t.x} ${t.y}`;
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
    <g className="kiteframe-edge" onClick={(e) => {
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
          cursor: edge.interactable !== false ? 'pointer' : 'default'
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
        markerStart={edge.markers?.position === 'start' || edge.markers?.position === 'both' ? `url(#${markerStartId})` : undefined}
        markerEnd={edge.markers?.position !== 'start' ? `url(#${markerId})` : undefined}
        filter={style.shadow ? `url(#${shadowId})` : style.glow ? `url(#${glowId})` : undefined}
        style={{ 
          cursor: edge.interactable !== false ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          pointerEvents: 'none' // Let the invisible path handle clicks
        }}
      />
      
      {/* Edge label */}
      {edge.label && (
        <g>
          {edge.labelStyle?.backgroundColor && (
            <rect
              x={(s.x + t.x) / 2 - (edge.label.length * 4)}
              y={(s.y + t.y) / 2 - 8}
              width={edge.label.length * 8}
              height={16}
              fill={edge.labelStyle.backgroundColor}
              rx={edge.labelStyle.borderRadius || 4}
            />
          )}
          <text 
            x={(s.x + t.x) / 2} 
            y={(s.y + t.y) / 2} 
            textAnchor="middle" 
            dominantBaseline="middle"
            fontSize={edge.labelStyle?.fontSize || 10}
            fill={edge.labelStyle?.fontColor || '#64748b'}
            fontWeight={edge.labelStyle?.fontWeight || 'normal'}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
};