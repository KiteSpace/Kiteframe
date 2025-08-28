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

export type Edge = {
  id: string;
  source: string;
  target: string;
  type?: 'straight'|'bezier'|'step';
  animated?: boolean;
  label?: string;
  data?: any;
};