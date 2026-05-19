import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface SketchCanvasHandle {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

interface SketchCanvasProps {
  isActive: boolean;
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  opacity: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  function SketchCanvas({ isActive, tool, color, size, opacity, onHistoryChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const undoStack = useRef<ImageData[]>([]);
    const redoStack = useRef<ImageData[]>([]);

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const notifyHistory = useCallback(() => {
      onHistoryChange?.(undoStack.current.length > 0, redoStack.current.length > 0);
    }, [onHistoryChange]);

    const saveSnapshot = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      redoStack.current = [];
      notifyHistory();
    }, [notifyHistory]);

    const undo = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx || undoStack.current.length === 0) return;
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      redoStack.current.push(current);
      const snapshot = undoStack.current.pop()!;
      ctx.putImageData(snapshot, 0, 0);
      notifyHistory();
    }, [notifyHistory]);

    const redo = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx || redoStack.current.length === 0) return;
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStack.current.push(current);
      const snapshot = redoStack.current.pop()!;
      ctx.putImageData(snapshot, 0, 0);
      notifyHistory();
    }, [notifyHistory]);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      saveSnapshot();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      notifyHistory();
    }, [saveSnapshot, notifyHistory]);

    useImperativeHandle(ref, () => ({
      undo,
      redo,
      canUndo: () => undoStack.current.length > 0,
      canRedo: () => redoStack.current.length > 0,
      clear,
    }), [undo, redo, clear]);

    // Resize canvas to match container
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;

      const observer = new ResizeObserver(() => {
        const ctx = getCtx();
        if (!ctx || !canvas) return;
        const prevData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        ctx.putImageData(prevData, 0, 0);
      });

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (e instanceof TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return null;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
    };

    const startStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();
      saveSnapshot();
      isDrawing.current = true;
      const pos = getPos(e);
      lastPoint.current = pos;

      const ctx = getCtx();
      if (!ctx || !pos) return;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity / 100;
      }
      ctx.fill();
    }, [isActive, tool, color, size, opacity, saveSnapshot]);

    const drawStroke = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isActive || !isDrawing.current) return;
      e.preventDefault();
      const ctx = getCtx();
      const pos = getPos(e);
      if (!ctx || !pos || !lastPoint.current) return;

      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity / 100;
      }

      const midX = (lastPoint.current.x + pos.x) / 2;
      const midY = (lastPoint.current.y + pos.y) / 2;

      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
      ctx.stroke();

      lastPoint.current = pos;
    }, [isActive, tool, color, size, opacity]);

    const endStroke = useCallback(() => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      lastPoint.current = null;
      const ctx = getCtx();
      if (ctx) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }, []);

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

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          zIndex: 50,
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
