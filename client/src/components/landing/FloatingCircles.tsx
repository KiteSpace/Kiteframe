import { useEffect, useState } from 'react';

interface Circle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
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

export default function FloatingCircles() {
  const [circles, setCircles] = useState<Circle[]>([]);

  useEffect(() => {
    const generated: Circle[] = [];
    for (let i = 0; i < 5; i++) {
      generated.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 40 + Math.random() * 120,
        color: CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)],
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 4,
      });
    }
    setCircles(generated);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {circles.map((circle) => (
        <div
          key={circle.id}
          className="absolute rounded-full"
          style={{
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            width: circle.size,
            height: circle.size,
            backgroundColor: circle.color,
            animation: `floatUpDown ${circle.duration}s ease-in-out infinite, slowRotate 25s linear infinite`,
            animationDelay: `${circle.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes floatUpDown {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
        @keyframes slowRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
