import React from 'react';
import type { Edge, Node } from '../types';

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

export const ConnectionEdge: React.FC<{ edge: Edge; sourceNode: Node; targetNode: Node; }> = ({ edge, sourceNode, targetNode }) => {
  const s = anchor(sourceNode, targetNode);
  const t = anchor(targetNode, sourceNode);
  const type = edge.type ?? 'bezier';
  let d = '';
  let arrowAngle = 0;
  
  // Calculate the path and determine arrow direction based on final segment
  if (type === 'straight') {
    d = `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
    // Calculate angle from source to target
    arrowAngle = Math.atan2(t.y - s.y, t.x - s.x) * (180 / Math.PI);
  } else if (type === 'step') {
    const mx = s.x + (t.x - s.x)/2;
    d = `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${t.y} L ${t.x} ${t.y}`;
    // For step edges, the final segment is from (mx, t.y) to (t.x, t.y)
    arrowAngle = Math.atan2(0, t.x - mx) * (180 / Math.PI); // Horizontal line
  } else {
    // For bezier curves, calculate direction based on the final control point
    const c1x = s.x + (t.x - s.x) * .5, c1y = s.y;
    const c2x = t.x - (t.x - s.x) * .5, c2y = t.y;
    d = `M ${s.x} ${s.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${t.x} ${t.y}`;
    // Calculate angle from the second control point to target
    arrowAngle = Math.atan2(t.y - c2y, t.x - c2x) * (180 / Math.PI);
  }
  
  const stroke = edge.data?.color || '#64748b';
  const width = edge.data?.strokeWidth ?? 2;
  const animated = edge.animated || edge.data?.animated;
  
  // Create unique marker ID to avoid conflicts between multiple edges
  const markerId = `kf-arrow-${edge.id}`;
  
  return (
    <g className="kiteframe-edge">
      <defs>
        <marker 
          id={markerId} 
          viewBox="0 0 10 7" 
          refX="9" 
          refY="3.5" 
          markerWidth="10" 
          markerHeight="7" 
          orient={arrowAngle}
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={stroke} />
        </marker>
      </defs>
      <path 
        d={d} 
        fill="none" 
        stroke={stroke} 
        strokeWidth={width} 
        markerEnd={`url(#${markerId})`} 
        strokeDasharray={animated?'6 4':undefined} 
      />
      {edge.label && <text x={(s.x+t.x)/2} y={(s.y+t.y)/2} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-slate-600">{edge.label}</text>}
    </g>
  );
};