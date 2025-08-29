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
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
};

type Viewport = { x: number; y: number; zoom: number };

export const KiteFrameCanvas: React.FC<Props> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalViewport, setInternalViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{x:number;y:number}|null>(null);
  const [selectRect, setSelectRect] = useState<null | {x:number;y:number;w:number;h:number}>(null);
  const selectStart = useRef<{x:number;y:number}|null>(null);
  const [connecting, setConnecting] = useState<null | { sourceId:string; wx:number; wy:number }>(null);

  // Use external viewport if provided, otherwise use internal state
  const viewport = props.viewport || internalViewport;
  const setViewport = (newViewport: Viewport | ((prev: Viewport) => Viewport)) => {
    const next = typeof newViewport === 'function' ? newViewport(viewport) : newViewport;
    if (props.onViewportChange) {
      props.onViewportChange(next);
    } else {
      setInternalViewport(next);
    }
  };

  const minZoom = props.minZoom ?? 0.1;
  const maxZoom = props.maxZoom ?? 3;

  // Wheel/pinch zoom (cursor-anchored)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
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
    const rect = containerRef.current?.getBoundingClientRect();
    const worldCoords = rect ? clientToWorld(e.clientX, e.clientY, viewport, rect) : null;
    
    console.log('🔽 BACKGROUND DOWN:', {
      isShift,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      cursor: { clientX: e.clientX, clientY: e.clientY },
      containerRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
      viewport: viewport,
      worldCoords: worldCoords,
      source: 'canvas-background'
    });
    
    if (!isShift && !props.disablePan) {
      setPanning(true);
      panStart.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
      console.log('🟢 PAN START:', { panStart: panStart.current });
    } else if (isShift) {
      // Store client coordinates relative to the container, not the page
      const containerRect = rect || { left: 0, top: 0 };
      const relativeX = e.clientX - containerRect.left;
      const relativeY = e.clientY - containerRect.top;
      
      selectStart.current = { x: relativeX, y: relativeY };
      setSelectRect({ x: relativeX, y: relativeY, w: 0, h: 0 });
      console.log('🔲 SELECT START:', { 
        selectStart: selectStart.current,
        initialRect: { x: relativeX, y: relativeY, w: 0, h: 0 },
        clientCoords: { x: e.clientX, y: e.clientY },
        containerRect: containerRect,
        source: 'container-relative-coordinates'
      });
    }
  };
  const onBackgroundMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const worldCoords = rect ? clientToWorld(e.clientX, e.clientY, viewport, rect) : null;
    
    if (panning && panStart.current) {
      const newViewport = { ...viewport, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y };
      console.log('🔄 PAN MOVE:', {
        cursor: { clientX: e.clientX, clientY: e.clientY },
        panStart: panStart.current,
        oldViewport: viewport,
        newViewport: newViewport
      });
      setViewport(newViewport);
    } else if (selectStart.current) {
      // Calculate current position relative to container
      const containerRect = rect || { left: 0, top: 0 };
      const relativeX = e.clientX - containerRect.left;
      const relativeY = e.clientY - containerRect.top;
      
      const sx = selectStart.current.x, sy = selectStart.current.y;
      const newRect = { 
        x: Math.min(sx, relativeX), 
        y: Math.min(sy, relativeY), 
        w: Math.abs(relativeX - sx), 
        h: Math.abs(relativeY - sy) 
      };
      setSelectRect(newRect);
      
      console.log('🔲 SELECT DRAG:', {
        cursor: { clientX: e.clientX, clientY: e.clientY },
        containerRelative: { x: relativeX, y: relativeY },
        selectStart: selectStart.current,
        selectRect: newRect,
        worldCoords: worldCoords,
        viewport: viewport,
        source: 'container-relative-coordinates'
      });
    } else if (connecting && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const wpos = clientToWorld(e.clientX, e.clientY, viewport, rect);
      setConnecting(c => c ? { ...c, wx: wpos.x, wy: wpos.y } : null);
      
      console.log('🔗 CONNECTION MOVE:', {
        cursor: { clientX: e.clientX, clientY: e.clientY },
        worldCoords: wpos,
        viewport: viewport
      });
    }
  };
  const onBackgroundUp = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const worldCoords = rect ? clientToWorld(e.clientX, e.clientY, viewport, rect) : null;
    
    console.log('🔼 BACKGROUND UP:', {
      cursor: { clientX: e.clientX, clientY: e.clientY },
      worldCoords: worldCoords,
      viewport: viewport,
      selectRect: selectRect,
      panning: panning,
      connecting: connecting
    });
    
    if (panning) { 
      console.log('🔴 PAN END');
      setPanning(false); 
      panStart.current = null; 
    }
    
    if (selectStart.current && selectRect && containerRef.current) {
      console.log('🔲 PROCESSING SELECTION:', { 
        hasSelectStart: !!selectStart.current, 
        hasSelectRect: !!selectRect, 
        hasContainer: !!containerRef.current 
      });
      
      const rect = containerRef.current.getBoundingClientRect();
      const r = selectRect;
      
      // Transform selection rectangle from container-relative coordinates to world coordinates
      const x1 = (r.x - viewport.x) / viewport.zoom;
      const y1 = (r.y - viewport.y) / viewport.zoom;
      const x2 = ((r.x + r.w) - viewport.x) / viewport.zoom;
      const y2 = ((r.y + r.h) - viewport.y) / viewport.zoom;
      const nx1 = Math.min(x1,x2), ny1=Math.min(y1,y2), nx2=Math.max(x1,x2), ny2=Math.max(y1,y2);
      
      console.log('🔲 SELECT END - COORDINATE TRANSFORMATION:', {
        selectRect: r,
        containerRect: { left: rect.left, top: rect.top },
        viewport: viewport,
        clientCoords: { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y + r.h },
        transformedCoords: { x1, y1, x2, y2 },
        worldBounds: { nx1, ny1, nx2, ny2 },
        source: 'client-to-world-transform'
      });
      
      // Check which nodes overlap with the selection (not just completely inside)
      const nodeSelections = props.nodes.map(n => {
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const nodeX1 = n.position.x;
        const nodeY1 = n.position.y;
        const nodeX2 = n.position.x + w;
        const nodeY2 = n.position.y + h;
        
        // Check for overlap: rectangles overlap if they intersect on both axes
        const overlapsX = nodeX1 <= nx2 && nodeX2 >= nx1;
        const overlapsY = nodeY1 <= ny2 && nodeY2 >= ny1;
        const overlaps = overlapsX && overlapsY;
        
        console.log(`🔍 NODE ${n.id} SELECTION CHECK:`, {
          nodePosition: n.position,
          nodeSize: { w, h },
          nodeBounds: { x1: nodeX1, y1: nodeY1, x2: nodeX2, y2: nodeY2 },
          selectionBounds: { nx1, ny1, nx2, ny2 },
          overlapsX: overlapsX,
          overlapsY: overlapsY,
          selected: overlaps,
          source: 'overlap-detection'
        });
        
        return { ...n, selected: overlaps };
      });
      
      props.onNodesChange(nodeSelections);
      setSelectRect(null); 
      selectStart.current = null;
    }
    
    if (connecting && containerRef.current) {
      const srcId = connecting.sourceId;
      const rect = containerRef.current.getBoundingClientRect();
      const world = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const threshold = 16;
      
      console.log('🔗 CONNECTION END:', {
        cursor: { clientX: e.clientX, clientY: e.clientY },
        worldCoords: world,
        sourceId: srcId,
        threshold: threshold
      });
      
      let best: { id:string; dist:number } | null = null;
      for (const n of props.nodes) {
        if (n.id === srcId) continue;
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
      if (best) props.onConnect({ source: srcId, target: best.id });
      setConnecting(null);
    }
  };

  // Node dragging (individual and group)
  const dragInfo = useRef<{ 
    id:string; 
    start:{x:number;y:number}; 
    origins: {id:string; position:{x:number;y:number}}[];
    isGroupDrag: boolean;
  }|null>(null);
  
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const dx = wp.x - dragInfo.current.start.x;
      const dy = wp.y - dragInfo.current.start.y;
      
      console.log(`🎯 ${dragInfo.current.isGroupDrag ? 'GROUP' : 'NODE'} DRAG:`, {
        cursor: { clientX: e.clientX, clientY: e.clientY },
        worldCoords: wp,
        dragStart: dragInfo.current.start,
        delta: { dx, dy },
        dragType: dragInfo.current.isGroupDrag ? 'group' : 'individual',
        nodeCount: dragInfo.current.origins.length,
        viewport: viewport,
        source: 'world-coordinates'
      });
      
      // Update all dragged nodes (either just one or the whole selection)
      const updated = props.nodes.map(n => {
        const draggedNode = dragInfo.current!.origins.find(o => o.id === n.id);
        if (draggedNode) {
          return { ...n, position: { x: draggedNode.position.x + dx, y: draggedNode.position.y + dy } };
        }
        return n;
      });
      props.onNodesChange(updated);
    };
    const onUp = () => { dragInfo.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [viewport, props.nodes]);

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
      <div className="kiteframe-world" style={worldStyle}>
        {/* Edges - Extended SVG layer to cover large canvas area */}
        <svg 
          className="kiteframe-edge-layer" 
          style={{ 
            position: 'absolute',
            left: '-5000px',
            top: '-5000px',
            width: '10000px', 
            height: '10000px',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
          viewBox="-5000 -5000 10000 10000"
          preserveAspectRatio="none"
        >
          {props.edges.map(e => {
            const s = props.nodes.find(n => n.id === e.source);
            const t = props.nodes.find(n => n.id === e.target);
            if (!s || !t) return null;
            return <ConnectionEdge key={e.id} edge={e} sourceNode={s} targetNode={t} />;
          })}
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
                  ? selectedNodes.map(node => ({ id: node.id, position: { ...node.position } }))
                  : [{ id: n.id, position: { ...n.position } }];
                
                dragInfo.current = { 
                  id: n.id, 
                  start: wp, 
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
                setConnecting({ sourceId: n.id, wx: wp.x, wy: wp.y });
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