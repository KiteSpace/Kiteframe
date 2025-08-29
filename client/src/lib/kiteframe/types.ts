export type Position = { x: number; y: number };

export type Node = {
  id: string;
  type?: string;
  position: Position;
  data: any;
  style?: { width?: number; height?: number };
  draggable?: boolean;
  selectable?: boolean;
  doubleClickable?: boolean;
  resizable?: boolean;
  showHandles?: boolean;
  selected?: boolean;
  hidden?: boolean;
  smartConnect?: { enabled: boolean; threshold?: number };
  width?: number;
  height?: number;
};

export type EdgeStyle = {
  strokeWidth?: number;
  strokeColor?: string;
  strokeDasharray?: string;
  strokeOpacity?: number;
  fill?: string;
  gradient?: {
    type: 'linear' | 'radial';
    stops: { offset: string; color: string; opacity?: number }[];
    direction?: string;
  };
  shadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
  glow?: {
    color: string;
    intensity: number;
  };
  pattern?: 'dots' | 'lines' | 'waves' | 'zigzag';
};

export type EdgeMarker = {
  type: 'arrow' | 'circle' | 'square' | 'diamond' | 'triangle';
  size?: number;
  color?: string;
  position?: 'start' | 'end' | 'both';
};

export type Edge = {
  id: string;
  source: string;
  target: string;
  type?: 'straight' | 'bezier' | 'step' | 'curved' | 'orthogonal' | 'smoothstep';
  animated?: boolean;
  label?: string;
  labelStyle?: {
    fontSize?: number;
    fontColor?: string;
    fontWeight?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
  style?: EdgeStyle;
  markers?: EdgeMarker;
  curvature?: number; // For curved edges
  cornerRadius?: number; // For step edges
  selected?: boolean;
  hidden?: boolean;
  interactable?: boolean;
  data?: any; // Keep for backward compatibility
};