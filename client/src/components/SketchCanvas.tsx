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
  copySelection: () => boolean;
  paste: () => boolean;
  canPaste: () => boolean;
  /** Programmatically select strokes by index (works even if isActive is false). */
  selectStroke: (indices: number[]) => void;
}

interface SketchClipboard {
  strokes: SketchStroke[];
  anchorScreen: { x: number; y: number };
  originalCenterWorld: { x: number; y: number };
  pasteCount: number;
}

export interface SketchSelection {
  strokeIndices: number[];
  screenX: number;
  screenY: number;
  stroke: SketchStroke;
}

interface SketchCanvasProps {
  isActive: boolean;
  tool: 'pen' | 'eraser' | 'cursor' | 'lasso';
  color: string;
  size: number;
  opacity: number;
  lineStyle: 'solid' | 'dashed';
  dashLen: number;
  dashGap: number;
  smoothing?: boolean;
  viewport: { x: number; y: number; zoom: number };
  strokes?: SketchStroke[];
  hiddenStrokeIndices?: ReadonlySet<number>;
  lockedStrokeIndices?: ReadonlySet<number>;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onStrokesChange?: (strokes: SketchStroke[]) => void;
  onSelectionChange?: (selection: SketchSelection | null) => void;
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

export function findNearestStroke(wx: number, wy: number, strokes: SketchStroke[], zoom: number, exclude?: ReadonlySet<number>): number {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokes[i].tool === 'eraser') continue;
    if (exclude?.has(i)) continue;
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

function strokesSelectionCenter(
  indices: number[],
  strokes: SketchStroke[],
  vp: { x: number; y: number; zoom: number }
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const idx of indices) {
    for (const pt of strokes[idx].points) {
      minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
    }
  }
  return {
    screenX: ((minX + maxX) / 2) * vp.zoom + vp.x,
    screenY: minY * vp.zoom + vp.y,
  };
}

function strokeIntersectsWorldRect(
  stroke: SketchStroke,
  wx: number, wy: number, ww: number, wh: number
): boolean {
  return stroke.points.some(
    p => p.x >= wx && p.x <= wx + ww && p.y >= wy && p.y <= wy + wh
  );
}

function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  smooth: boolean
) {
  if (pts.length < 2) return;
  if (smooth) {
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
      hiddenStrokeIndices, lockedStrokeIndices,
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
    const hiddenRef = useRef<ReadonlySet<number>>(hiddenStrokeIndices ?? new Set());
    hiddenRef.current = hiddenStrokeIndices ?? new Set();
    const lockedRef = useRef<ReadonlySet<number>>(lockedStrokeIndices ?? new Set());
    lockedRef.current = lockedStrokeIndices ?? new Set();

    const selectedStrokeIndicesRef = useRef<Set<number>>(new Set());
    const clipboardRef = useRef<SketchClipboard | null>(null);
    const cursorDragMode = useRef<null | 'vertex' | 'stroke'>(null);
    const cursorDragVertexIdx = useRef(-1);
    const cursorDragLastPos = useRef<{ x: number; y: number } | null>(null);
    const lassoRectRef = useRef<{
      startScreen: { x: number; y: number };
      currentScreen: { x: number; y: number };
    } | null>(null);

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const notifyHistory = useCallback(() => {
      onHistoryChange?.(undoStack.current.length > 0, redoStack.current.length > 0);
    }, [onHistoryChange]);

    const notifySelectionMulti = useCallback((indices: Set<number>) => {
      const strokes = strokesRef.current;
      const valid = Array.from(indices).filter(i => i >= 0 && i < strokes.length);
      if (valid.length === 0) {
        selectedStrokeIndicesRef.current = new Set();
        onSelectionChangeRef.current?.(null);
        return;
      }
      selectedStrokeIndicesRef.current = new Set(valid);
      const pos = strokesSelectionCenter(valid, strokes, viewportRef.current);
      onSelectionChangeRef.current?.({
        strokeIndices: valid,
        ...pos,
        stroke: strokes[valid[0]],
      });
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
      const hiddenSet = hiddenRef.current;

      for (let _i = 0; _i < strokes.length; _i++) {
        if (hiddenSet.has(_i)) continue;
        const stroke = strokes[_i];
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

      const selIndices = selectedStrokeIndicesRef.current;
      const isMulti = selIndices.size > 1;

      for (const selIdx of Array.from(selIndices)) {
        if (selIdx < 0 || selIdx >= strokes.length) continue;
        if (hiddenSet.has(selIdx)) continue;
        const stroke = strokes[selIdx];
        if (stroke.points.length < 2) continue;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = (stroke.size + 6) / vp.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        drawStrokePath(ctx, stroke.points, smooth);
      }

      if (!isMulti && selIndices.size === 1) {
        const [selIdx] = Array.from(selIndices);
        if (selIdx >= 0 && selIdx < strokes.length) {
          const stroke = strokes[selIdx];
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
      }

      ctx.restore();

      const lr = lassoRectRef.current;
      if (lr) {
        const x = Math.min(lr.startScreen.x, lr.currentScreen.x);
        const y = Math.min(lr.startScreen.y, lr.currentScreen.y);
        const w = Math.abs(lr.currentScreen.x - lr.startScreen.x);
        const h = Math.abs(lr.currentScreen.y - lr.startScreen.y);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.12)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.85;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      }
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

    const getScreenPos = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (e instanceof TouchEvent) {
        const touch = e.touches[0] ?? e.changedTouches[0];
        if (!touch) return null;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
    };

    const startStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();
      const zoom = viewportRef.current.zoom;

      if (toolRef.current === 'lasso') {
        const sp = getScreenPos(e);
        if (!sp) return;
        lassoRectRef.current = { startScreen: sp, currentScreen: sp };
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
        return;
      }

      const pos = getPos(e);
      if (!pos) return;

      if (toolRef.current === 'cursor') {
        const isShift = (e instanceof MouseEvent) ? e.shiftKey : false;
        const excludeSet = new Set<number>([...Array.from(hiddenRef.current), ...Array.from(lockedRef.current)]);
        const hitIdx = findNearestStroke(pos.x, pos.y, strokesRef.current, zoom, excludeSet);

        if (isShift) {
          if (hitIdx >= 0) {
            const next = new Set(selectedStrokeIndicesRef.current);
            if (next.has(hitIdx)) {
              next.delete(hitIdx);
            } else {
              next.add(hitIdx);
            }
            notifySelectionMulti(next);
            cursorDragMode.current = null;
            cursorDragLastPos.current = null;
          }
          const ctx = getCtx();
          if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
          return;
        }

        const selIndices = selectedStrokeIndicesRef.current;
        if (selIndices.size === 1) {
          const [selIdx] = Array.from(selIndices);
          if (selIdx >= 0 && selIdx < strokesRef.current.length) {
            const vIdx = findNearestVertex(pos.x, pos.y, strokesRef.current[selIdx], zoom);
            if (vIdx >= 0) {
              cursorDragMode.current = 'vertex';
              cursorDragVertexIdx.current = vIdx;
              cursorDragLastPos.current = pos;
              return;
            }
          }
        }

        if (hitIdx >= 0) {
          cursorDragMode.current = 'stroke';
          cursorDragLastPos.current = pos;
          notifySelectionMulti(new Set([hitIdx]));
        } else {
          cursorDragMode.current = null;
          notifySelectionMulti(new Set());
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
    }, [isActive, notifyHistory, notifySelectionMulti, redrawAll]);

    const drawStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();

      if (toolRef.current === 'lasso') {
        if (!lassoRectRef.current) return;
        const sp = getScreenPos(e);
        if (!sp) return;
        lassoRectRef.current = { ...lassoRectRef.current, currentScreen: sp };
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
        return;
      }

      const pos = getPos(e);
      if (!pos) return;

      if (toolRef.current === 'cursor') {
        if (!cursorDragLastPos.current) return;
        const dx = pos.x - cursorDragLastPos.current.x;
        const dy = pos.y - cursorDragLastPos.current.y;
        cursorDragLastPos.current = pos;
        const selIndices = selectedStrokeIndicesRef.current;
        if (selIndices.size === 0) return;

        let strokes: SketchStroke[];
        if (cursorDragMode.current === 'vertex' && selIndices.size === 1) {
          const [selIdx] = Array.from(selIndices);
          const vIdx = cursorDragVertexIdx.current;
          strokes = strokesRef.current.map((s, i) => {
            if (i !== selIdx) return s;
            const newPts = s.points.map((p, j) => j === vIdx ? { x: p.x + dx, y: p.y + dy } : p);
            return { ...s, points: newPts };
          });
        } else {
          strokes = strokesRef.current.map((s, i) =>
            selIndices.has(i) ? { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) } : s
          );
        }
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
      if (toolRef.current === 'lasso') {
        const lr = lassoRectRef.current;
        if (!lr) return;
        const vp = viewportRef.current;
        const dx = lr.currentScreen.x - lr.startScreen.x;
        const dy = lr.currentScreen.y - lr.startScreen.y;
        const hasArea = Math.abs(dx) > 4 || Math.abs(dy) > 4;
        if (hasArea) {
          const sx = Math.min(lr.startScreen.x, lr.currentScreen.x);
          const sy = Math.min(lr.startScreen.y, lr.currentScreen.y);
          const sw = Math.abs(dx);
          const sh = Math.abs(dy);
          const wx = (sx - vp.x) / vp.zoom;
          const wy = (sy - vp.y) / vp.zoom;
          const ww = sw / vp.zoom;
          const wh = sh / vp.zoom;
          const found = new Set<number>();
          const hiddenSet = hiddenRef.current;
          const lockedSet = lockedRef.current;
          strokesRef.current.forEach((s, i) => {
            if (hiddenSet.has(i) || lockedSet.has(i)) return;
            if (s.tool !== 'eraser' && strokeIntersectsWorldRect(s, wx, wy, ww, wh)) {
              found.add(i);
            }
          });
          notifySelectionMulti(found);
        } else {
          notifySelectionMulti(new Set());
        }
        lassoRectRef.current = null;
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
        return;
      }

      if (toolRef.current === 'cursor') {
        if (cursorDragMode.current && cursorDragLastPos.current) {
          onStrokesChange?.(strokesRef.current);
          const selIndices = selectedStrokeIndicesRef.current;
          if (selIndices.size > 0) {
            const valid = Array.from(selIndices).filter(i => i >= 0 && i < strokesRef.current.length);
            if (valid.length > 0) {
              const pos = strokesSelectionCenter(valid, strokesRef.current, viewportRef.current);
              onSelectionChangeRef.current?.({
                strokeIndices: valid,
                ...pos,
                stroke: strokesRef.current[valid[0]],
              });
            }
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
    }, [onStrokesChange, redrawAll, notifySelectionMulti]);

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
      selectedStrokeIndicesRef.current = new Set();
      onSelectionChangeRef.current?.(null);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, [], []);
      notifyHistory();
    }, [notifyHistory, onStrokesChange, redrawAll]);

    const clearSelection = useCallback(() => {
      selectedStrokeIndicesRef.current = new Set();
      onSelectionChangeRef.current?.(null);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
    }, [redrawAll]);

    const copySelection = useCallback((): boolean => {
      const indices = Array.from(selectedStrokeIndicesRef.current);
      if (indices.length === 0) return false;
      const strokes = strokesRef.current;
      const valid = indices.filter(i => i >= 0 && i < strokes.length);
      if (valid.length === 0) return false;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const idx of valid) {
        for (const pt of strokes[idx].points) {
          minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
        }
      }
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const vp = viewportRef.current;
      clipboardRef.current = {
        strokes: valid.map(i => ({
          ...strokes[i],
          points: strokes[i].points.map(p => ({ ...p })),
        })),
        anchorScreen: { x: cx * vp.zoom + vp.x, y: cy * vp.zoom + vp.y },
        originalCenterWorld: { x: cx, y: cy },
        pasteCount: 0,
      };
      return true;
    }, []);

    const paste = useCallback((): boolean => {
      const clipboard = clipboardRef.current;
      if (!clipboard || clipboard.strokes.length === 0) return false;
      const vp = viewportRef.current;
      const newCenterWorld = {
        x: (clipboard.anchorScreen.x - vp.x) / vp.zoom,
        y: (clipboard.anchorScreen.y - vp.y) / vp.zoom,
      };
      const worldDx = newCenterWorld.x - clipboard.originalCenterWorld.x;
      const worldDy = newCenterWorld.y - clipboard.originalCenterWorld.y;
      const nudge = (clipboard.pasteCount + 1) * 20 / vp.zoom;
      const pasted = clipboard.strokes.map(s => ({
        ...s,
        points: s.points.map(p => ({
          x: p.x + worldDx + nudge,
          y: p.y + worldDy + nudge,
        })),
      }));
      clipboardRef.current = { ...clipboard, pasteCount: clipboard.pasteCount + 1 };
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      const startIdx = strokesRef.current.length;
      strokesRef.current = [...strokesRef.current, ...pasted];
      onStrokesChange?.(strokesRef.current);
      const newIndices = new Set<number>();
      for (let i = 0; i < pasted.length; i++) newIndices.add(startIdx + i);
      notifySelectionMulti(newIndices);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
      notifyHistory();
      return true;
    }, [onStrokesChange, notifySelectionMulti, redrawAll, notifyHistory]);

    const selectStroke = useCallback((indices: number[]) => {
      const valid = new Set(indices.filter(i => i >= 0 && i < strokesRef.current.length));
      notifySelectionMulti(valid);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
    }, [notifySelectionMulti, redrawAll]);

    useImperativeHandle(ref, () => ({
      undo, redo,
      canUndo: () => undoStack.current.length > 0,
      canRedo: () => redoStack.current.length > 0,
      clear,
      getStrokes: () => strokesRef.current,
      clearSelection,
      hasSelection: () => selectedStrokeIndicesRef.current.size > 0,
      copySelection,
      paste,
      canPaste: () => (clipboardRef.current?.strokes.length ?? 0) > 0,
      selectStroke,
    }), [undo, redo, clear, clearSelection, copySelection, paste, selectStroke]);

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
      const selIndices = selectedStrokeIndicesRef.current;
      if (selIndices.size > 0) {
        const valid = Array.from(selIndices).filter(i => i >= 0 && i < strokesRef.current.length);
        if (valid.length > 0) {
          const pos = strokesSelectionCenter(valid, strokesRef.current, viewport);
          onSelectionChangeRef.current?.({
            strokeIndices: valid,
            ...pos,
            stroke: strokesRef.current[valid[0]],
          });
        }
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

    // Prune selection when strokes become hidden/locked, and re-render
    useEffect(() => {
      const sel = selectedStrokeIndicesRef.current;
      if (sel.size > 0) {
        const hidden = hiddenStrokeIndices ?? new Set<number>();
        const locked = lockedStrokeIndices ?? new Set<number>();
        const next = new Set<number>();
        sel.forEach(i => { if (!hidden.has(i) && !locked.has(i)) next.add(i); });
        if (next.size !== sel.size) {
          notifySelectionMulti(next);
        }
      }
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
    }, [hiddenStrokeIndices, lockedStrokeIndices, notifySelectionMulti, redrawAll]);

    useEffect(() => {
      if (initialStrokes) {
        strokesRef.current = initialStrokes;
        const maxIdx = initialStrokes.length - 1;
        const next = new Set(Array.from(selectedStrokeIndicesRef.current).filter(i => i <= maxIdx));
        selectedStrokeIndicesRef.current = next;
        if (next.size === 0) onSelectionChangeRef.current?.(null);
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
      }
    }, [initialStrokes, redrawAll]);

    const cursorStyle = (() => {
      if (!isActive) return 'default';
      if (tool === 'cursor') return 'default';
      if (tool === 'lasso') return 'crosshair';
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
