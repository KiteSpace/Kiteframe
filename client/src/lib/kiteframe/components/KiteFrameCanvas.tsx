import React, { useEffect, useRef, useState } from 'react';
import '../styles/kiteframe.css';
import type { Node, Edge } from '../types';
import { clientToWorld, zoomAroundPoint } from '../utils/geometry';
import { NodeHandles } from './NodeHandles';
import { ConnectionEdge } from './ConnectionEdge';

type Props = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (n: Node[]) => void;
  onEdgesChange: (e: Edge[]) => void;
  onConnect: (c: { source: string; target: string }) => void;
  gridType?: 'dots'|'lines'|'none';
  minZoom?: number;
  maxZoom?: number;
  fitView?: boolean;
  showMiniMap?: boolean;
  selectedNodes?: string[];
  onNodeClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasClick?: () => void;
  onNodeDoubleClick?: (e: React.MouseEvent, node: Node) => void;
  onNodeRightClick?: (e: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (e: React.MouseEvent, edge: Edge) => void;
  onNodeResize?: (id: string, w: number, h: number) => void;
  smartConnect?: boolean;
  snapToGuides?: boolean;
  snapToGrid?: boolean;
  className?: string;
  onImageUpload?: (id:string, data:string)=>void;
  onImageUrlSet?: (id:string, url:string)=>void;
  disablePan?: boolean;
};

type Viewport = { x: number; y: number; zoom: number };

type ConnectingState = {
  sourceId: string;
  wx: number; // world x following cursor
  wy: number; // world y following cursor
  hoverTargetId: string | null; // node under cursor (if any)
  eligible: boolean; // can connect source -> hoverTargetId?
};

export const KiteFrameCanvas: React.FC<Props> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{x:number;y:number}|null>(null);
  const [selectRect, setSelectRect] = useState<null | {x:number;y:number;w:number;h:number}>(null);
  const selectStart = useRef<{x:number;y:number}|null>(null);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);

  const minZoom = props.minZoom ?? 0.1;
  const maxZoom = props.maxZoom ?? 3;

  // ---------- helpers ----------
  const getNodeRect = (n: Node) => {
    const w = n.style?.width ?? n.width ?? 200;
    const h = n.style?.height ?? n.height ?? 100;
    return {
      x: n.position.x,
      y: n.position.y,
      w, h,
      cx: n.position.x + w/2,
      cy: n.position.y + h/2,
    };
  };

  const pointInNode = (x: number, y: number, n: Node) => {
    const r = getNodeRect(n);
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };

  const findDroppableTarget = (wx: number, wy: number) => {
    // prioritize topmost nodes (later in array can be on top if you layer)
    for (let i = props.nodes.length - 1; i >= 0; i--) {
      const n = props.nodes[i];
      if (n.hidden) continue;
      if (pointInNode(wx, wy, n)) return n;
    }
    return null;
  };

  const edgeExists = (sourceId: string, targetId: string) =>
    props.edges.some(e => e.source === sourceId && e.target === targetId);

  // choose an exit anchor on source node towards (tx, ty)
  const sourceAnchorTowards = (src: Node, tx: number, ty: number) => {
    const r = getNodeRect(src);
    const dx = tx - r.cx;
    const dy = ty - r.cy;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx >= absDy) {
      // horizontal exit
      return dx >= 0 ? { x: r.x + r.w, y: r.cy } : { x: r.x, y: r.cy };
    } else {
      // vertical exit
      return dy >= 0 ? { x: r.cx, y: r.y + r.h } : { x: r.cx, y: r.y };
    }
  };

  // Wheel/pinch zoom (cursor-anchored)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const old = viewport;
    const newZoom = zoomAroundPoint(old.zoom, e.deltaY * 0.001, minZoom, maxZoom);
    const mouseWorld = clientToWorld(e.clientX, e.clientY, old, rect);
    const newX = e.clientX - rect.left - mouseWorld.x * newZoom;
    const newY = e.clientY - rect.top - mouseWorld.y * newZoom;
    setViewport({ x: newX, y: newY, zoom: newZoom });
  };

  // Background interactions: pan or selection (Shift+drag)
  const onBackgroundDown = (e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    if (!isShift && !props.disablePan) {
      setPanning(true);
      panStart.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    } else if (isShift) {
      const rect = containerRef.current!.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;
      selectStart.current = { x: containerX, y: containerY };
      setSelectRect({ x: containerX, y: containerY, w: 0, h: 0 });
    }
  };

  const onBackgroundMove = (e: React.MouseEvent) => {
    if (panning && panStart.current) {
      const panStartRef = panStart.current; // Capture reference to avoid race condition
      setViewport(v => ({ ...v, x: e.clientX - panStartRef.x, y: e.clientY - panStartRef.y }));
      return;
    }
    if (selectStart.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;
      const sx = selectStart.current.x, sy = selectStart.current.y;
      setSelectRect({ 
        x: Math.min(sx, containerX), 
        y: Math.min(sy, containerY), 
        w: Math.abs(containerX - sx), 
        h: Math.abs(containerY - sy) 
      });
      return;
    }
    if (connecting) {
      const rect = containerRef.current!.getBoundingClientRect();
      const wpos = clientToWorld(e.clientX, e.clientY, viewport, rect);
      // find droppable node under cursor (body, not only handle)
      const target = findDroppableTarget(wpos.x, wpos.y);
      let hoverTargetId: string | null = null;
      let eligible = false;
      if (target) {
        hoverTargetId = target.id;
        // rules: cannot connect to self; cannot create duplicate edge
        eligible = (target.id !== connecting.sourceId) && !edgeExists(connecting.sourceId, target.id);
      }
      setConnecting(c => c ? { ...c, wx: wpos.x, wy: wpos.y, hoverTargetId, eligible } : null);
      return;
    }
  };

  const onBackgroundUp = (e: React.MouseEvent) => {
    if (panning) {
      setPanning(false); panStart.current = null;
    }
    if (selectStart.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const r = selectRect!;
      const x1 = (r.x - rect.left - viewport.x) / viewport.zoom;
      const y1 = (r.y - rect.top - viewport.y) / viewport.zoom;
      const x2 = ((r.x + r.w) - rect.left - viewport.x) / viewport.zoom;
      const y2 = ((r.y + r.h) - rect.top - viewport.y) / viewport.zoom;
      const nx1 = Math.min(x1,x2), ny1=Math.min(y1,y2), nx2=Math.max(x1,x2), ny2=Math.max(y1,y2);
      const updated = props.nodes.map(n => {
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const inside = n.position.x >= nx1 && n.position.y >= ny1 && (n.position.x + w) <= nx2 && (n.position.y + h) <= ny2;
        return { ...n, selected: inside };
      });
      props.onNodesChange(updated);
      setSelectRect(null); selectStart.current = null;
    }
    if (connecting) {
      const { sourceId, hoverTargetId, eligible } = connecting;

      // If hovering a valid node, connect directly (no need to land on handle)
      if (hoverTargetId && eligible) {
        props.onConnect({ source: sourceId, target: hoverTargetId });
        setConnecting(null);
        return;
      }

      // fallback: nearest-handle threshold logic (optional)
      const rect = containerRef.current!.getBoundingClientRect();
      const world = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const threshold = 16;
      let best: { id:string; dist:number } | null = null;
      for (const n of props.nodes) {
        if (n.id === sourceId) continue;
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const handles = [
          { x: n.position.x + w/2, y: n.position.y },
          { x: n.position.x + w/2, y: n.position.y + h },
          { x: n.position.x,       y: n.position.y + h/2 },
          { x: n.position.x + w,   y: n.position.y + h/2 },
        ];
        for (const pt of handles) {
          const d = Math.hypot(pt.x - world.x, pt.y - world.y);
          if (d < threshold && (!best || d < best.dist)) best = { id: n.id, dist: d };
        }
      }
      if (best && !edgeExists(sourceId, best.id)) {
        props.onConnect({ source: sourceId, target: best.id });
      }
      setConnecting(null);
    }
  };

  // Node dragging with group support
  const dragInfo = useRef<{ 
    id: string; 
    start: {x:number;y:number}; 
    origin: {x:number;y:number}; 
    origins?: {id: string; origin: {x:number;y:number}}[];
    isGroupDrag?: boolean;
  }|null>(null);
  
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const dx = wp.x - dragInfo.current.start.x;
      const dy = wp.y - dragInfo.current.start.y;
      
      if (dragInfo.current.isGroupDrag && dragInfo.current.origins) {
        // Group drag: move all selected nodes
        const updated = props.nodes.map(n => {
          const nodeOrigin = dragInfo.current!.origins!.find(o => o.id === n.id);
          if (nodeOrigin) {
            return { ...n, position: { x: nodeOrigin.origin.x + dx, y: nodeOrigin.origin.y + dy } };
          }
          return n;
        });
        props.onNodesChange(updated);
        
        console.log(`🎯 GROUP DRAG:`, {
          cursor: { clientX: e.clientX, clientY: e.clientY },
          worldCoords: wp,
          dragStart: dragInfo.current.start,
          delta: { dx, dy },
          dragType: 'group',
          nodeCount: dragInfo.current.origins.length,
          viewport: viewport,
          source: 'world-coordinates'
        });
      } else {
        // Individual drag: move single node
        const id = dragInfo.current.id;
        const updated = props.nodes.map(n => n.id === id ? { ...n, position: { x: dragInfo.current!.origin.x + dx, y: dragInfo.current!.origin.y + dy } } : n);
        props.onNodesChange(updated);
        
        console.log(`🎯 NODE DRAG:`, {
          cursor: { clientX: e.clientX, clientY: e.clientY },
          worldCoords: wp,
          dragStart: dragInfo.current.start,
          delta: { dx, dy },
          dragType: 'individual',
          nodeCount: 1,
          viewport: viewport,
          source: 'world-coordinates'
        });
      }
    };
    
    const onUp = () => { 
      if (dragInfo.current) {
        console.log(`🔼 ${dragInfo.current.isGroupDrag ? 'GROUP' : 'NODE'} DRAG END`);
      }
      dragInfo.current = null; 
    };
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [viewport, props.nodes]);

  // Grid (optional – keep your existing grid if you have one)
  const Grid = () => {
    if (props.gridType === 'none') return null;
    return (
      <svg className="kiteframe-grid">
        {props.gridType === 'lines' && (
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
          </pattern>
        )}
        <rect width="100%" height="100%" fill={props.gridType==='lines' ? 'url(#grid)' : 'none'} />
      </svg>
    );
  };

  const worldStyle = { transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` };

  return (
    <div
      ref={containerRef}
      className={`kiteframe-canvas ${props.className||''} ${panning ? 'kiteframe-hand': ''}`}
      onWheel={onWheel}
      onMouseDown={onBackgroundDown}
      onMouseMove={onBackgroundMove}
      onMouseUp={onBackgroundUp}
      onClick={() => props.onCanvasClick?.()}
    >
      <Grid />
      <div className="kiteframe-world" style={worldStyle}>
        {/* Existing edges */}
        <svg className="kiteframe-edge-layer" style={{ 
          position: 'absolute',
          left: '-5000px',
          top: '-5000px',
          width: '10000px', 
          height: '10000px',
          pointerEvents: 'none',
          overflow: 'visible'
        }}
        viewBox="-5000 -5000 10000 10000"
        preserveAspectRatio="none">
          {props.edges.map(e => {
            const s = props.nodes.find(n => n.id === e.source);
            const t = props.nodes.find(n => n.id === e.target);
            if (!s || !t) return null;
            return <ConnectionEdge key={e.id} edge={e} sourceNode={s} targetNode={t} />;
          })}

          {/* PREVIEW EDGE while dragging a connection */}
          {connecting && (() => {
            const src = props.nodes.find(n => n.id === connecting.sourceId);
            if (!src) return null;

            // Where to draw to: hovered node center (if exists) else cursor world position
            let tx = connecting.wx, ty = connecting.wy;
            let stroke = '#cbd5e1';          // grey (default)
            let dash = '6 4';                // dashed for preview
            if (connecting.hoverTargetId) {
              const tgt = props.nodes.find(n => n.id === connecting.hoverTargetId);
              if (tgt) {
                const r = getNodeRect(tgt);
                tx = r.cx; ty = r.cy;
                if (connecting.eligible) stroke = '#22c55e'; // green eligible
                else stroke = '#ef4444'; // red ineligible
              }
            }

            // Source anchor smart-positioned
            const anchor = sourceAnchorTowards(src, tx, ty);
            const sx = anchor.x, sy = anchor.y;

            // Simple straight line for preview
            return (
              <line
                key="preview"
                x1={sx} y1={sy}
                x2={tx} y2={ty}
                stroke={stroke}
                strokeWidth="2"
                strokeDasharray={dash}
                markerEnd="url(#arrowhead)"
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}
        </svg>

        {/* Nodes */}
        {props.nodes.filter(n=>!n.hidden).map(n => {
          const w = n.style?.width ?? n.width ?? 200;
          const h = n.style?.height ?? n.height ?? 100;
          const color = n.data?.color || 'white';
          const border = n.data?.borderColor || '#e2e8f0';
          const txt = n.data?.textColor || '#0f172a';
          return (
            <div
              key={n.id}
              className={`kiteframe-node group ${n.selected?'selected':''}`}
              style={{ left: n.position.x, top: n.position.y, width: w, height: h, background: color, borderColor: border, color: txt }}
              onMouseDown={(e)=>{
                e.stopPropagation();
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
                
                // Check if this node is selected and if there are other selected nodes
                const selectedNodes = props.nodes.filter(node => node.selected === true);
                const isGroupDrag = selectedNodes.length > 1 && n.selected === true;
                
                // Prepare origins for all nodes that will be dragged
                const origins = isGroupDrag 
                  ? selectedNodes.map(node => ({ id: node.id, origin: { ...node.position } }))
                  : [{ id: n.id, origin: { ...n.position } }];
                
                dragInfo.current = { 
                  id: n.id, 
                  start: wp, 
                  origin: { ...n.position },
                  origins: origins,
                  isGroupDrag: isGroupDrag
                };
                
                console.log(`🎯 ${isGroupDrag ? 'GROUP' : 'NODE'} ${n.id} DRAG START:`, {
                  cursor: { clientX: e.clientX, clientY: e.clientY },
                  worldCoords: wp,
                  clickedNodePosition: n.position,
                  clickedNodeSelected: n.selected,
                  isGroupDrag: isGroupDrag,
                  selectedNodesCount: selectedNodes.length,
                  allSelectedNodes: selectedNodes.map(s => ({ id: s.id, selected: s.selected })),
                  draggedNodes: origins.map(o => o.id),
                  viewport: viewport,
                  source: 'node-mousedown'
                });
              }}
              onDoubleClick={(e)=>props.onNodeDoubleClick?.(e, n)}
              onContextMenu={(e)=>{ e.preventDefault(); props.onNodeRightClick?.(e, n); }}
              onClick={(e)=>props.onNodeClick?.(e, n)}
            >
              <div className="title">{n.data?.label || n.type || n.id}</div>
              <div className="body">
                {n.type === 'image' && n.data?.src ? <img src={n.data.src} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />: (n.data?.description || 'Drop content here…')}
              </div>
              {n.showHandles !== false && <NodeHandles node={n} onHandleConnect={(p, e)=>{
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
                setConnecting({ sourceId: n.id, wx: wp.x, wy: wp.y, hoverTargetId: null, eligible: false });
              }} />}
            </div>
          );
        })}
      </div>
      
      {/* Selection rectangle - positioned in client coordinates, outside transformed world */}
      {selectRect && (
        <div 
          className="kiteframe-select-rect" 
          style={{ 
            position: 'absolute',
            left: selectRect.x, 
            top: selectRect.y, 
            width: selectRect.w, 
            height: selectRect.h,
            border: '1px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 1000
          }} 
        />
      )}
    </div>
  );
};