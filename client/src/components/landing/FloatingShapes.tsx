import { useEffect, useState, useMemo } from 'react';

type ShapeType = 'circle' | 'square' | 'triangle';

interface Shape {
  id: number;
  type: ShapeType;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  delay: number;
  duration: number;
}

const CIRCLE_COLORS = [
  'rgba(196, 181, 253, 0.3)',
  'rgba(167, 139, 250, 0.25)',
  'rgba(139, 92, 246, 0.2)',
  'rgba(124, 58, 237, 0.15)',
  'rgba(224, 231, 255, 0.4)',
  'rgba(199, 210, 254, 0.35)',
];

const SQUARE_COLORS = [
  'rgba(187, 247, 208, 0.3)',
  'rgba(134, 239, 172, 0.25)',
  'rgba(74, 222, 128, 0.2)',
  'rgba(34, 197, 94, 0.15)',
  'rgba(220, 252, 231, 0.4)',
];

const TRIANGLE_COLORS = [
  'rgba(254, 240, 138, 0.3)',
  'rgba(253, 224, 71, 0.25)',
  'rgba(250, 204, 21, 0.2)',
  'rgba(234, 179, 8, 0.15)',
  'rgba(254, 249, 195, 0.4)',
];

export default function FloatingShapes() {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    const generated: Shape[] = [];
    let id = 0;

    for (let i = 0; i < 5; i++) {
      generated.push({
        id: id++,
        type: 'circle',
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 40 + Math.random() * 100,
        color: CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)],
        rotation: 0,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 4,
      });
    }

    for (let i = 0; i < 3; i++) {
      generated.push({
        id: id++,
        type: 'square',
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 30 + Math.random() * 80,
        color: SQUARE_COLORS[Math.floor(Math.random() * SQUARE_COLORS.length)],
        rotation: Math.random() * 45,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 4,
      });
    }

    for (let i = 0; i < 2; i++) {
      generated.push({
        id: id++,
        type: 'triangle',
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 30 + Math.random() * 70,
        color: TRIANGLE_COLORS[Math.floor(Math.random() * TRIANGLE_COLORS.length)],
        rotation: Math.random() * 360,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 4,
      });
    }

    setShapes(generated);
  }, []);

  const keyframes = useMemo(() => {
    return shapes.map(shape => {
      const rot = shape.rotation;
      if (shape.type === 'circle') {
        return `
          @keyframes float-${shape.id} {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-12px) rotate(0deg); }
          }
          @keyframes rotate-${shape.id} {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
      }
      return `
        @keyframes float-${shape.id} {
          0%, 100% { transform: translateY(0px) rotate(${rot}deg); }
          50% { transform: translateY(-12px) rotate(${rot}deg); }
        }
        @keyframes rotate-${shape.id} {
          0% { transform: rotate(${rot}deg); }
          100% { transform: rotate(${rot + 360}deg); }
        }
      `;
    }).join('\n');
  }, [shapes]);

  const renderShape = (shape: Shape) => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${shape.x}%`,
      top: `${shape.y}%`,
      animation: `float-${shape.id} ${shape.duration}s ease-in-out infinite, rotate-${shape.id} 20s linear infinite`,
      animationDelay: `${shape.delay}s`,
    };

    if (shape.type === 'circle') {
      return (
        <div
          key={shape.id}
          className="rounded-full"
          style={{
            ...baseStyle,
            width: shape.size,
            height: shape.size,
            backgroundColor: shape.color,
          }}
        />
      );
    }

    if (shape.type === 'square') {
      return (
        <div
          key={shape.id}
          className="rounded-md"
          style={{
            ...baseStyle,
            width: shape.size,
            height: shape.size,
            backgroundColor: shape.color,
          }}
        />
      );
    }

    if (shape.type === 'triangle') {
      return (
        <div
          key={shape.id}
          style={{
            ...baseStyle,
            width: 0,
            height: 0,
            borderLeft: `${shape.size / 2}px solid transparent`,
            borderRight: `${shape.size / 2}px solid transparent`,
            borderBottom: `${shape.size}px solid ${shape.color}`,
            backgroundColor: 'transparent',
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{keyframes}</style>
      {shapes.map(renderShape)}
    </div>
  );
}
