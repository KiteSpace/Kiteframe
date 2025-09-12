import React, { useRef, useEffect, useState } from 'react';

export interface AnimationConfig {
  duration: number; // Animation duration in ms
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic';
  pulseOnConnection: boolean;
  showParticles: boolean;
  glowOnHover: boolean;
}

interface AnimatedConnectionPreviewProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isConnecting: boolean;
  isValidTarget: boolean;
  isInvalidTarget: boolean;
  onAnimationEnd?: () => void;
  config?: Partial<AnimationConfig>;
}

const defaultConfig: AnimationConfig = {
  duration: 300,
  easing: 'ease-out',
  pulseOnConnection: true,
  showParticles: false,
  glowOnHover: true
};

// Easing functions
const easingFunctions = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  bounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  elastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  }
};

export const AnimatedConnectionPreview: React.FC<AnimatedConnectionPreviewProps> = ({
  x1,
  y1,
  x2,
  y2,
  isConnecting,
  isValidTarget,
  isInvalidTarget,
  onAnimationEnd,
  config: userConfig = {}
}) => {
  const config = { ...defaultConfig, ...userConfig };
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [showPulse, setShowPulse] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();
  
  // Animation state
  const [particles, setParticles] = useState<Array<{ x: number; y: number; id: number; progress: number }>>([]);
  const particleIdRef = useRef(0);

  // Calculate line properties
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Dynamic colors based on connection state
  const getColors = () => {
    if (isInvalidTarget) {
      return {
        stroke: '#ef4444',
        glow: '#fee2e2',
        particles: '#fca5a5'
      };
    } else if (isValidTarget) {
      return {
        stroke: '#22c55e',
        glow: '#dcfce7',
        particles: '#86efac'
      };
    } else {
      return {
        stroke: '#6366f1',
        glow: '#e0e7ff',
        particles: '#a5b4fc'
      };
    }
  };

  const colors = getColors();

  // Animate connection progress
  useEffect(() => {
    if (!isConnecting) {
      setAnimatedProgress(0);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / config.duration, 1);
      const easedProgress = easingFunctions[config.easing](progress);
      
      setAnimatedProgress(easedProgress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = undefined;
        if (config.pulseOnConnection && (isValidTarget || isInvalidTarget)) {
          setShowPulse(true);
          setTimeout(() => setShowPulse(false), 600);
        }
        onAnimationEnd?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isConnecting, x1, y1, x2, y2, config.duration, config.easing, config.pulseOnConnection, isValidTarget, isInvalidTarget]);

  // Particle system for enhanced visual feedback
  useEffect(() => {
    if (!config.showParticles || !isConnecting) {
      setParticles([]);
      return;
    }

    const interval = setInterval(() => {
      if (animatedProgress > 0.3) {
        const newParticle = {
          x: x1 + (x2 - x1) * Math.random() * 0.8,
          y: y1 + (y2 - y1) * Math.random() * 0.8,
          id: particleIdRef.current++,
          progress: 0
        };
        
        setParticles(prev => [...prev, newParticle].slice(-5)); // Keep max 5 particles
      }
    }, 150);

    return () => clearInterval(interval);
  }, [config.showParticles, isConnecting, animatedProgress, x1, y1, x2, y2]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    const animateParticles = () => {
      setParticles(prev => prev
        .map(particle => ({
          ...particle,
          progress: particle.progress + 0.05
        }))
        .filter(particle => particle.progress < 1)
      );
    };

    const interval = setInterval(animateParticles, 16); // ~60fps
    return () => clearInterval(interval);
  }, [particles.length]);

  if (!isConnecting && animatedProgress === 0) {
    return null;
  }

  // Calculate animated endpoint
  const animatedX2 = x1 + (x2 - x1) * animatedProgress;
  const animatedY2 = y1 + (y2 - y1) * animatedProgress;

  return (
    <g className="animated-connection-preview">
      {/* Glow effect */}
      {config.glowOnHover && (isValidTarget || isInvalidTarget) && (
        <defs>
          <filter id={`connection-glow-${Date.now()}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      )}

      {/* Main connection line */}
      <line
        x1={x1}
        y1={y1}
        x2={animatedX2}
        y2={animatedY2}
        stroke={colors.stroke}
        strokeWidth="3"
        strokeDasharray="8,4"
        strokeLinecap="round"
        opacity={0.8}
        filter={config.glowOnHover && (isValidTarget || isInvalidTarget) ? `url(#connection-glow-${Date.now()})` : undefined}
        className="transition-all duration-200"
        style={{
          strokeDashoffset: isConnecting ? -16 + (16 * animatedProgress) : 0
        }}
        data-testid="animated-connection-line"
      />

      {/* Animated arrow head */}
      {animatedProgress > 0.1 && (
        <polygon
          points={`${animatedX2},${animatedY2} ${animatedX2 - 8 * Math.cos(angle - Math.PI/6)},${animatedY2 - 8 * Math.sin(angle - Math.PI/6)} ${animatedX2 - 8 * Math.cos(angle + Math.PI/6)},${animatedY2 - 8 * Math.sin(angle + Math.PI/6)}`}
          fill={colors.stroke}
          opacity={0.9}
          className="transition-all duration-200"
          data-testid="animated-arrow-head"
        />
      )}

      {/* Connection point indicator */}
      {animatedProgress > 0.8 && (
        <circle
          cx={animatedX2}
          cy={animatedY2}
          r="6"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="2"
          opacity={0.7}
          className={showPulse ? 'animate-ping' : ''}
          data-testid="connection-point-indicator"
        />
      )}

      {/* Particle effects */}
      {config.showParticles && particles.map(particle => (
        <circle
          key={particle.id}
          cx={particle.x}
          cy={particle.y}
          r={2 * (1 - particle.progress)}
          fill={colors.particles}
          opacity={1 - particle.progress}
          data-testid={`particle-${particle.id}`}
        />
      ))}

      {/* Success/Error pulse effect */}
      {showPulse && (
        <circle
          cx={x2}
          cy={y2}
          r="15"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="3"
          opacity="0"
          className="animate-ping"
          data-testid="connection-pulse"
        />
      )}
    </g>
  );
};