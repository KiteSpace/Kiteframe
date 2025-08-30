import React, { useEffect, useRef, useState } from 'react';
import '../styles/kiteframe.css';
import type { Node, Edge } from '../types';
import { clientToWorld, zoomAroundPoint } from '../utils/geometry';
import { NodeHandles } from './NodeHandles';
import { ConnectionEdge } from './ConnectionEdge';

// Utility to calculate dynamic node height based on content
const calculateNodeHeight = (node: Node, nodeWidth: number): number => {
  const minHeight = 100;
  const maxHeight = 400;
  const titleHeight = 34; // Approximate title height with padding
  const padding = 24; // Body padding (12px top + 12px bottom)
  const lineHeight = 16.8; // 12px font-size * 1.4 line-height
  
  // For image nodes with images, defer to explicit sizing
  if (node.type === 'image' && node.data?.src) {
    return minHeight; // Will be overridden by explicit height anyway
  }
  
  // Get text content
  const titleText = node.data?.label || node.type || node.id;
  const bodyText = node.data?.description || 'Drop content here…';
  
  if (!bodyText || bodyText.trim() === 'Drop content here…') {
    return minHeight;
  }
  
  // Estimate character width (approximate for 12px font)
  const avgCharWidth = 7;
  const availableWidth = nodeWidth - 24; // Subtract body padding
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  
  // Calculate lines needed for title
  const titleCharsPerLine = Math.max(1, Math.floor((nodeWidth - 24) / avgCharWidth)); // Title area
  const titleLines = Math.max(1, Math.ceil(titleText.length / titleCharsPerLine));
  
  // Calculate lines needed for body text
  const bodyLines = bodyText.split('\n').reduce((totalLines: number, line: string) => {
    if (line.length === 0) return totalLines + 1;
    return totalLines + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  
  // Calculate total height needed
  const titleRequiredHeight = titleLines * 15.6; // 12px * 1.3 line-height
  const bodyRequiredHeight = Math.max(40, bodyLines * lineHeight); // min-height 40px
  const calculatedHeight = titleRequiredHeight + bodyRequiredHeight + padding + 1; // +1 for border
  
  // Apply constraints
  return Math.min(maxHeight, Math.max(minHeight, Math.ceil(calculatedHeight)));
};

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
  onImageButtonClick?: (nodeId: string) => void;
  smartConnect?: boolean;
  snapToGuides?: boolean;
  snapToGrid?: boolean;
  className?: string;
  onImageUpload?: (id:string, data:string)=>void;
  onImageUrlSet?: (id:string, url:string)=>void;
  disablePan?: boolean;
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
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
  const [internalViewport, setInternalViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  
  // Use external viewport if provided, otherwise use internal
  const viewport = props.viewport || internalViewport;
  const setViewport = props.onViewportChange || setInternalViewport;
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
    const h = n.style?.height ?? n.height ?? calculateNodeHeight(n, w);
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
      setViewport({ ...viewport, x: e.clientX - panStartRef.x, y: e.clientY - panStartRef.y });
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
      
      console.log(`🔲 SELECT END - COORDINATE TRANSFORMATION:`, {
        selectRect: r,
        containerRect: { left: rect.left, top: rect.top },
        viewport: viewport,
        clientCoords: { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y + r.h },
        transformedCoords: { x1, y1, x2, y2 },
        worldBounds: { nx1, ny1, nx2, ny2 },
        source: 'client-to-world-transform'
      });
      
      const updated = props.nodes.map(n => {
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const nodeBounds = {
          x1: n.position.x,
          y1: n.position.y,
          x2: n.position.x + w,
          y2: n.position.y + h
        };
        
        // Use overlap detection instead of complete containment
        const overlapsX = nodeBounds.x1 < nx2 && nodeBounds.x2 > nx1;
        const overlapsY = nodeBounds.y1 < ny2 && nodeBounds.y2 > ny1;
        const selected = overlapsX && overlapsY;
        
        console.log(`🔍 NODE ${n.id} SELECTION CHECK:`, {
          nodePosition: n.position,
          nodeSize: { w, h },
          nodeBounds,
          selectionBounds: { nx1, ny1, nx2, ny2 },
          overlapsX,
          overlapsY,
          selected,
          source: 'overlap-detection'
        });
        
        return { ...n, selected };
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
  
  // Simple drag tracking without interference
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      
      const rect = containerRef.current!.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const dx = wp.x - dragInfo.current.start.x;
      const dy = wp.y - dragInfo.current.start.y;
      
      console.log('🔧 DRAG MOVE:', {
        dragInfo: dragInfo.current,
        worldPos: wp,
        delta: { dx, dy },
        viewport,
        isGroupDrag: dragInfo.current.isGroupDrag
      });
      
      if (dragInfo.current.isGroupDrag && dragInfo.current.origins) {
        // Group drag: move all selected nodes
        const updated = props.nodes.map(n => {
          const nodeOrigin = dragInfo.current!.origins!.find(o => o.id === n.id);
          if (nodeOrigin) {
            return { ...n, position: { x: nodeOrigin.origin.x + dx, y: nodeOrigin.origin.y + dy } };
          }
          return n;
        });
        console.log('🔧 GROUP DRAG UPDATE:', {
          updatedNodes: updated.filter(n => dragInfo.current!.origins!.some(o => o.id === n.id)),
          totalNodes: updated.length
        });
        props.onNodesChange(updated);
        

      } else {
        // Individual drag: move single node
        const id = dragInfo.current.id;
        const updated = props.nodes.map(n => n.id === id ? { ...n, position: { x: dragInfo.current!.origin.x + dx, y: dragInfo.current!.origin.y + dy } } : n);
        console.log('🔧 INDIVIDUAL DRAG UPDATE:', {
          nodeId: id,
          newPosition: { x: dragInfo.current!.origin.x + dx, y: dragInfo.current!.origin.y + dy },
          updated: updated.find(n => n.id === id)
        });
        props.onNodesChange(updated);
        

      }
    };
    
    const onUp = () => { 
      console.log('🔧 DRAG END:', dragInfo.current);
      dragInfo.current = null;
    };
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [viewport, props]);

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
            return <ConnectionEdge key={e.id} edge={e} sourceNode={s} targetNode={t} onEdgeClick={(edge) => props.onEdgeClick?.(e as any, edge)} />;
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
          // Use dynamic height calculation if no explicit height is set
          const h = n.style?.height ?? n.height ?? calculateNodeHeight(n, w);
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
                
                console.log('🔧 DRAG START:', {
                  nodeId: n.id,
                  worldPos: wp,
                  nodePosition: n.position,
                  selectedNodes: selectedNodes.map(sn => sn.id),
                  isGroupDrag,
                  dragInfo: dragInfo.current
                });
              }}
              onDoubleClick={(e)=>props.onNodeDoubleClick?.(e, n)}
              onContextMenu={(e)=>{ e.preventDefault(); props.onNodeRightClick?.(e, n); }}
              onClick={(e) => {
                e.stopPropagation();
                console.log(`🎯 NODE CLICK:`, { nodeId: n.id, wasSelected: n.selected });
                props.onNodeClick?.(e, n);
              }}
            >
              <div className="title">{n.data?.label || n.type || n.id}</div>
              <div 
                className="body" 
                style={{ 
                  padding: n.type === 'image' ? '0' : undefined,
                  height: n.type === 'image' ? `${h - 30}px` : undefined, // Account for title height
                  display: n.type === 'image' ? 'flex' : undefined,
                  alignItems: n.type === 'image' ? 'center' : undefined,
                  justifyContent: n.type === 'image' ? 'center' : undefined
                }}
              >
                {n.type === 'image' ? (
                  n.data?.src ? 
                    <img 
                      src={n.data.src} 
                      alt="" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        width: n.data?.imageSize === 'fill' ? '100%' : 'auto',
                        height: n.data?.imageSize === 'fill' ? '100%' : 'auto',
                        objectFit: n.data?.imageSize === 'fill' ? 'cover' : 
                                   n.data?.imageSize === 'fit' ? 'scale-down' : 
                                   'contain',
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        draggable: false
                      } as React.CSSProperties} 
                    /> : 
                    <div style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      color: '#666',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      gap: '8px'
                    }}>
                      {n.data?.displayText ? (
                        <div style={{
                          fontSize: '11px',
                          color: n.data?.isImageBroken ? '#dc2626' : '#888',
                          fontStyle: 'italic',
                          marginBottom: '8px',
                          whiteSpace: 'pre-line',
                          textAlign: 'center'
                        }}>
                          {n.data?.isImageBroken && '⚠️ '}
                          {n.data.displayText}
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onImageButtonClick?.(n.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          border: '1px dashed #ccc',
                          borderRadius: '4px',
                          background: 'transparent',
                          color: '#666',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#007bff';
                          e.currentTarget.style.color = '#007bff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = '#ccc';
                          e.currentTarget.style.color = '#666';
                        }}
                      >
                        📷 Add Image
                      </button>
                    </div>
                ) : (
                  n.data?.description || 'Drop content here…'
                )}
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