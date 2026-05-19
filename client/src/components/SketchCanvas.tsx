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
}

interface SketchCanvasProps {
  isActive: boolean;
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  opacity: number;
  lineStyle: 'solid' | 'dashed';
  dashLen: number;
  dashGap: number;
  viewport: { x: number; y: number; zoom: number };
  strokes?: SketchStroke[];
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onStrokesChange?: (strokes: SketchStroke[]) => void;
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  function SketchCanvas(
    { isActive, tool, color, size, opacity, lineStyle, dashLen, dashGap, viewport, strokes: initialStrokes, onHistoryChange, onStrokesChange },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const currentStrokePoints = useRef<Array<{ x: number; y: number }>>([]);
    const strokesRef = useRef<SketchStroke[]>(initialStrokes ?? []);
    const undoStack = useRef<SketchStroke[][]>([]);
    const redoStack = useRef<SketchStroke[][]>([]);
    // Safety reset: when initialStrokes identity changes (e.g. tab switch without full remount),
    // clear undo/redo stacks so history from a previous tab cannot bleed through.
    const prevInitialStrokesRef = useRef(initialStrokes);
    useEffect(() => {
      if (prevInitialStrokesRef.current !== initialStrokes) {
        prevInitialStrokesRef.current = initialStrokes;
        strokesRef.current = initialStrokes ?? [];
        undoStack.current = [];
        redoStack.current = [];
        onHistoryChange?.(false, false);
      }
    }, [initialStrokes, onHistoryChange]);

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

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const notifyHistory = useCallback(() => {
      onHistoryChange?.(undoStack.current.length > 0, redoStack.current.length > 0);
    }, [onHistoryChange]);

    const redrawAll = useCallback((ctx: CanvasRenderingContext2D, vp: { x: number; y: number; zoom: number }, strokes: SketchStroke[], currentPoints?: Array<{ x: number; y: number }>) => {
      const canvas = ctx.canvas;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.save();
      ctx.setTransform(vp.zoom, 0, 0, vp.zoom, vp.x, vp.y);

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

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
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

        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length - 1; i++) {
          const midX = (currentPoints[i].x + currentPoints[i + 1].x) / 2;
          const midY = (currentPoints[i].y + currentPoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(currentPoints[i].x, currentPoints[i].y, midX, midY);
        }
        const last = currentPoints[currentPoints.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }

      ctx.restore();
    }, []);

    const screenToWorld = (screenX: number, screenY: number) => {
      const vp = viewportRef.current;
      return {
        x: (screenX - vp.x) / vp.zoom,
        y: (screenY - vp.y) / vp.zoom,
      };
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
      isDrawing.current = true;
      const pos = getPos(e);
      if (!pos) return;

      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      notifyHistory();

      currentStrokePoints.current = [pos];

      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, currentStrokePoints.current);
    }, [isActive, notifyHistory, redrawAll]);

    const drawStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive || !isDrawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;

      currentStrokePoints.current.push(pos);

      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, currentStrokePoints.current);
    }, [isActive, redrawAll]);

    const endStroke = useCallback(() => {
      if (!isDrawing.current) return;
      isDrawing.current = false;

      if (currentStrokePoints.current.length >= 2) {
        const newStroke: SketchStroke = {
          points: [...currentStrokePoints.current],
          color: colorRef.current,
          size: sizeRef.current,
          opacity: opacityRef.current,
          tool: toolRef.current,
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
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, viewportRef.current, [], []);
      notifyHistory();
    }, [notifyHistory, onStrokesChange, redrawAll]);

    useImperativeHandle(ref, () => ({
      undo,
      redo,
      canUndo: () => undoStack.current.length > 0,
      canRedo: () => redoStack.current.length > 0,
      clear,
      getStrokes: () => strokesRef.current,
    }), [undo, redo, clear]);

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
    }, [viewport, redrawAll]);

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
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, viewportRef.current, strokesRef.current, []);
      }
    }, [initialStrokes, redrawAll]);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          zIndex: 20,
          pointerEvents: isActive ? 'auto' : 'none',
          cursor: isActive
            ? tool === 'eraser'
              ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${size + 4}' height='${size + 4}' viewBox='0 0 ${size + 4} ${size + 4}'><circle cx='${(size + 4) / 2}' cy='${(size + 4) / 2}' r='${size / 2}' fill='none' stroke='white' stroke-width='1.5'/></svg>") ${(size + 4) / 2} ${(size + 4) / 2}, crosshair`
              : 'crosshair'
            : 'default',
        }}
      />
    );
  }
);
