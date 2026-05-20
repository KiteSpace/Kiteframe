import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface SketchStroke {
  points: Array<{ x: number; y: number }>;
  color: string;
  size: number;
  opacity: number;
  tool: 'pen' | 'eraser';
  lineStyle: 'solid' | 'dashed';
  dashLen: number;
  dashGap: number;
}

export interface SketchCanvasHandle {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  getStrokes: () => SketchStroke[];
  clearSelection: () => void;
  hasSelection: () => boolean;
}

export interface SketchSelection {
  strokeIndex: number;
  screenX: number;
  screenY: number;
  stroke: SketchStroke;
}

interface SketchCanvasProps {
  isActive: boolean;
  tool: 'pen' | 'eraser' | 'cursor';
  color: string;
  size: number;
  opacity: number;
  lineStyle: 'solid' | 'dashed';
  dashLen: number;
  dashGap: number;
  smoothing?: boolean;
  viewport: { x: number; y: number; zoom: number };
  strokes?: SketchStroke[];
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onStrokesChange?: (strokes: SketchStroke[]) => void;
  onSelectionChange?: (selection: SketchSelection | null) => void;
}

function chaikin(pts: Array<{ x: number; y: number }>, passes = 2): Array<{ x: number; y: number }> {
  if (pts.length < 3) return pts;
  let result = pts;
  for (let p = 0; p < passes; p++) {
    const next: Array<{ x: number; y: number }> = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i], b = result[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

function ptSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function hitTestStroke(wx: number, wy: number, stroke: SketchStroke, zoom: number): boolean {
  const threshold = (8 + stroke.size / 2) / zoom;
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i], b = stroke.points[i + 1];
    if (ptSegDist(wx, wy, a.x, a.y, b.x, b.y) <= threshold) return true;
  }
  return false;
}

function findNearestStroke(wx: number, wy: number, strokes: SketchStroke[], zoom: number): number {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokes[i].tool === 'eraser') continue;
    if (hitTestStroke(wx, wy, strokes[i], zoom)) return i;
  }
  return -1;
}

function findNearestVertex(wx: number, wy: number, stroke: SketchStroke, zoom: number): number {
  const threshold = 8 / zoom;
  let best = -1, bestDist = Infinity;
  for (let i = 0; i < stroke.points.length; i++) {
    const d = Math.hypot(stroke.points[i].x - wx, stroke.points[i].y - wy);
    if (d < threshold && d < bestDist) { best = i; bestDist = d; }
  }
  return best;
}

function rdp(pts: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts;
  let maxDist = 0, maxIdx = 0;
  const start = pts[0], end = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptSegDist(pts[i].x, pts[i].y, start.x, start.y, end.x, end.y);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = rdp(pts.slice(0, maxIdx + 1), epsilon);
    const right = rdp(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function strokeBBoxCenter(stroke: SketchStroke, vp: { x: number; y: number; zoom: number }) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of stroke.points) {
    minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
  }
  return {
    screenX: ((minX + maxX) / 2) * vp.zoom + vp.x,
    screenY: minY * vp.zoom + vp.y,
  };
}

function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  smooth: boolean
) {
  if (pts.length < 2) return;
  if (smooth) {
    // Simplify with RDP first (removes noisy intermediate points → fewer vertices),
    // then draw through the key points with quadratic bezier curves → smooth appearance.
    const simplified = rdp(pts, 1.5);
    const sp = simplified.length >= 2 ? simplified : pts;
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    for (let i = 1; i < sp.length - 1; i++) {
      const midX = (sp[i].x + sp[i + 1].x) / 2;
      const midY = (sp[i].y + sp[i + 1].y) / 2;
      ctx.quadraticCurveTo(sp[i].x, sp[i].y, midX, midY);
    }
    ctx.lineTo(sp[sp.length - 1].x, sp[sp.length - 1].y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  function SketchCanvas(
    {
      isActive, tool, color, size, opacity, lineStyle, dashLen, dashGap,
      smoothing, viewport, strokes: initialStrokes,
      onHistoryChange, onStrokesChange, onSelectionChange,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const currentStrokePoints = useRef<Array<{ x: number; y: number }>>([]);
    const strokesRef = useRef<SketchStroke[]>(initialStrokes ?? []);
    const undoStack = useRef<SketchStroke[][]>([]);
    const redoStack = useRef<SketchStroke[][]>([]);

    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;
    const toolRef = useRef(tool);
    toolRef.current = tool;
    const colorRef = useRef(color);
    colorRef.current = color;
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const opacityRef = useRef(opacity);
    opacityRef.current = opacity;
    const lineStyleRef = useRef(lineStyle);
    lineStyleRef.current = lineStyle;
    const dashLenRef = useRef(dashLen);
    dashLenRef.current = dashLen;
    const dashGapRef = useRef(dashGap);
    dashGapRef.current = dashGap;
    const smoothingRef = useRef(smoothing ?? false);
    smoothingRef.current = smoothing ?? false;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;

    const selectedStrokeIdxRef = useRef(-1);
    const cursorDragMode = useRef<null | 'vertex' | 'stroke'>(null);
    const cursorDragVertexIdx = useRef(-1);
    const cursorDragLastPos = useRef<{ x: number; y: number } | null>(null);

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const notifyHistory = useCallback(() => {
      onHistoryChange?.(undoStack.current.length > 0, redoStack.current.length > 0);
    }, [onHistoryChange]);

    const notifySelection = useCallback((idx: number) => {
      const strokes = strokesRef.current;
      if (idx < 0 || idx >= strokes.length) {
        selectedStrokeIdxRef.current = -1;
        onSelectionChangeRef.current?.(null);
        return;
      }
      selectedStrokeIdxRef.current = idx;
      const pos = strokeBBoxCenter(strokes[idx], viewportRef.current);
      onSelectionChangeRef.current?.({ strokeIndex: idx, ...pos, stroke: strokes[idx] });
    }, []);

    const redrawAll = useCallback((
      ctx: CanvasRenderingContext2D,
      vp: { x: number; y: number; zoom: number },
      strokes: SketchStroke[],
      currentPoints?: Array<{ x: number; y: number }>
    ) => {
      const canvas = ctx.canvas;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.save();
      ctx.setTransform(vp.zoom, 0, 0, vp.zoom, vp.x, vp.y);

      const smooth = smoothingRef.current;

      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color;
          ctx.globalAlpha = stroke.opacity / 100;
          if (stroke.lineStyle === 'dashed') {
            ctx.setLineDash([stroke.dashLen / vp.zoom, stroke.dashGap / vp.zoom]);
          } else {
            ctx.setLineDash([]);
          }
        }
        ctx.lineWidth = stroke.size / vp.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawStrokePath(ctx, stroke.points, smooth);
      }

      if (currentPoints && currentPoints.length >= 2) {
        const curTool = toolRef.current;
        if (curTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = colorRef.current;
          ctx.globalAlpha = opacityRef.current / 100;
          if (lineStyleRef.current === 'dashed') {
            ctx.setLineDash([dashLenRef.current / vp.zoom, dashGapRef.current / vp.zoom]);
          } else {
            ctx.setLineDash([]);
          }
        }
        ctx.lineWidth = sizeRef.current / vp.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawStrokePath(ctx, currentPoints, smooth);
      }

      const selIdx = selectedStrokeIdxRef.current;
      if (selIdx >= 0 && selIdx < strokes.length) {
        const stroke = strokes[selIdx];
        if (stroke.points.length >= 2) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = (stroke.size + 6) / vp.zoom;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.setLineDash([]);
          drawStrokePath(ctx, stroke.points, smooth);
        }

        ctx.globalAlpha = 1;
        const hw = 5 / vp.zoom;
        for (const pt of stroke.points) {
          ctx.fillStyle = '#60a5fa';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 / vp.zoom;
          ctx.setLineDash([]);
          ctx.fillRect(pt.x - hw, pt.y - hw, hw * 2, hw * 2);
          ctx.strokeRect(pt.x - hw, pt.y - hw, hw * 2, hw * 2);
        }
      }

      ctx.restore();
    }, []);

    const screenToWorld = (screenX: number, screenY: number) => {
      const vp = viewportRef.current;
      return { x: (screenX - vp.x) / vp.zoom, y: (screenY - vp.y) / vp.zoom };
    };

    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      let screenX: number, screenY: number;
      if (e instanceof TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return null;
        screenX = touch.clientX - rect.left;
        screenY = touch.clientY - rect.top;
      } else {
        screenX = (e as MouseEvent).clientX - rect.left;
        screenY = (e as MouseEvent).clientY - rect.top;
      }
      return screenToWorld(screenX, screenY);
    };

    const startStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;
      const zoom = viewportRef.current.zoom;

      if (toolRef.current === 'cursor') {
        const selIdx = selectedStrokeIdxRef.current;

        if (selIdx >= 0 && selIdx < strokesRef.current.length) {
          const vIdx = findNearestVertex(pos.x, pos.y, strokesRef.current[selIdx], zoom);
          if (vIdx >= 0) {
            cursorDragMode.current = 'vertex';
            cursorDragVertexIdx.current = vIdx;
            cursorDragLastPos.current = pos;
            return;
          }
        }

        const hitIdx = findNearestStroke(pos.x, pos.y, strokesRef.current, zoom);
        if (hitIdx >= 0) {
          cursorDragMode.current = 'stroke';
          cursorDragLastPos.current = pos;
          notifySelection(hitIdx);
        } else {
          cursorDragMode.current = null;
          notifySelection(-1);
        }
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
        return;
      }

      isDrawing.current = true;
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      notifyHistory();
      currentStrokePoints.current = [pos];
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, currentStrokePoints.current);
    }, [isActive, notifyHistory, notifySelection, redrawAll]);

    const drawStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;

      if (toolRef.current === 'cursor') {
        if (!cursorDragLastPos.current) return;
        const dx = pos.x - cursorDragLastPos.current.x;
        const dy = pos.y - cursorDragLastPos.current.y;
        cursorDragLastPos.current = pos;
        const selIdx = selectedStrokeIdxRef.current;
        if (selIdx < 0 || selIdx >= strokesRef.current.length) return;

        const strokes = strokesRef.current.map((s, i) => {
          if (i !== selIdx) return s;
          if (cursorDragMode.current === 'vertex') {
            const vIdx = cursorDragVertexIdx.current;
            const newPts = s.points.map((p, j) => j === vIdx ? { x: p.x + dx, y: p.y + dy } : p);
            return { ...s, points: newPts };
          } else {
            return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          }
        });
        strokesRef.current = strokes;
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
        return;
      }

      if (!isDrawing.current) return;
      currentStrokePoints.current.push(pos);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, currentStrokePoints.current);
    }, [isActive, redrawAll]);

    const endStroke = useCallback(() => {
      if (toolRef.current === 'cursor') {
        if (cursorDragMode.current && cursorDragLastPos.current) {
          onStrokesChange?.(strokesRef.current);
          const selIdx = selectedStrokeIdxRef.current;
          if (selIdx >= 0 && selIdx < strokesRef.current.length) {
            const pos = strokeBBoxCenter(strokesRef.current[selIdx], viewportRef.current);
            onSelectionChangeRef.current?.({
              strokeIndex: selIdx, ...pos, stroke: strokesRef.current[selIdx]
            });
          }
        }
        cursorDragMode.current = null;
        cursorDragLastPos.current = null;
        return;
      }

      if (!isDrawing.current) return;
      isDrawing.current = false;

      if (currentStrokePoints.current.length >= 2) {
        const newStroke: SketchStroke = {
          points: currentStrokePoints.current,
          color: colorRef.current,
          size: sizeRef.current,
          opacity: opacityRef.current,
          tool: toolRef.current as 'pen' | 'eraser',
          lineStyle: lineStyleRef.current,
          dashLen: dashLenRef.current,
          dashGap: dashGapRef.current,
        };
        strokesRef.current = [...strokesRef.current, newStroke];
        onStrokesChange?.(strokesRef.current);
      }

      currentStrokePoints.current = [];
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
    }, [onStrokesChange, redrawAll]);

    const undo = useCallback(() => {
      if (undoStack.current.length === 0) return;
      redoStack.current.push([...strokesRef.current]);
      strokesRef.current = undoStack.current.pop()!;
      onStrokesChange?.(strokesRef.current);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
      notifyHistory();
    }, [notifyHistory, onStrokesChange, redrawAll]);

    const redo = useCallback(() => {
      if (redoStack.current.length === 0) return;
      undoStack.current.push([...strokesRef.current]);
      strokesRef.current = redoStack.current.pop()!;
      onStrokesChange?.(strokesRef.current);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
      notifyHistory();
    }, [notifyHistory, onStrokesChange, redrawAll]);

    const clear = useCallback(() => {
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      strokesRef.current = [];
      onStrokesChange?.([]);
      selectedStrokeIdxRef.current = -1;
      onSelectionChangeRef.current?.(null);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, [], []);
      notifyHistory();
    }, [notifyHistory, onStrokesChange, redrawAll]);

    const clearSelection = useCallback(() => {
      selectedStrokeIdxRef.current = -1;
      onSelectionChangeRef.current?.(null);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
    }, [redrawAll]);

    useImperativeHandle(ref, () => ({
      undo, redo,
      canUndo: () => undoStack.current.length > 0,
      canRedo: () => redoStack.current.length > 0,
      clear,
      getStrokes: () => strokesRef.current,
      clearSelection,
      hasSelection: () => selectedStrokeIdxRef.current >= 0,
    }), [undo, redo, clear, clearSelection]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      const observer = new ResizeObserver(() => {
        if (!canvas) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, currentStrokePoints.current);
      });
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      observer.observe(container);
      return () => observer.disconnect();
    }, [redrawAll]);

    useEffect(() => {
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewport, strokesRef.current, currentStrokePoints.current);
      if (selectedStrokeIdxRef.current >= 0 && selectedStrokeIdxRef.current < strokesRef.current.length) {
        const pos = strokeBBoxCenter(strokesRef.current[selectedStrokeIdxRef.current], viewport);
        onSelectionChangeRef.current?.({
          strokeIndex: selectedStrokeIdxRef.current, ...pos,
          stroke: strokesRef.current[selectedStrokeIdxRef.current],
        });
      }
    }, [viewport, redrawAll]);

    useEffect(() => {
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, currentStrokePoints.current);
    }, [smoothing, redrawAll]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.addEventListener('mousedown', startStroke, { passive: false });
      canvas.addEventListener('mousemove', drawStroke, { passive: false });
      canvas.addEventListener('mouseup', endStroke);
      canvas.addEventListener('mouseleave', endStroke);
      canvas.addEventListener('touchstart', startStroke, { passive: false });
      canvas.addEventListener('touchmove', drawStroke, { passive: false });
      canvas.addEventListener('touchend', endStroke);
      return () => {
        canvas.removeEventListener('mousedown', startStroke);
        canvas.removeEventListener('mousemove', drawStroke);
        canvas.removeEventListener('mouseup', endStroke);
        canvas.removeEventListener('mouseleave', endStroke);
        canvas.removeEventListener('touchstart', startStroke);
        canvas.removeEventListener('touchmove', drawStroke);
        canvas.removeEventListener('touchend', endStroke);
      };
    }, [startStroke, drawStroke, endStroke]);

    useEffect(() => {
      if (initialStrokes) {
        strokesRef.current = initialStrokes;
        if (selectedStrokeIdxRef.current >= initialStrokes.length) {
          selectedStrokeIdxRef.current = -1;
          onSelectionChangeRef.current?.(null);
        }
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
      }
    }, [initialStrokes, redrawAll]);

    const cursorStyle = (() => {
      if (!isActive) return 'default';
      if (tool === 'cursor') return 'default';
      if (tool === 'eraser') {
        const w = 22, h = 16;
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect x='1' y='1' width='${w - 2}' height='${h - 2}' rx='2' fill='%23fda4af' stroke='%23374151' stroke-width='1.5'/><rect x='1' y='${h - 5}' width='${w - 2}' height='3' fill='%23fff' opacity='0.55'/><line x1='1' y1='${h - 5}' x2='${w - 1}' y2='${h - 5}' stroke='%23374151' stroke-width='0.75'/></svg>`;
        return `url("data:image/svg+xml,${svg}") ${Math.floor(w / 2)} ${h - 1}, cell`;
      }
      return 'crosshair';
    })();

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 20, pointerEvents: isActive ? 'auto' : 'none', cursor: cursorStyle }}
      />
    );
  }
);
