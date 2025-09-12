export type Position = { x: number; y: number };

export type NodeColors = {
  headerBackground?: string;
  bodyBackground?: string;
  borderColor?: string;
  textColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
};

export type Node = {
  id: string;
  type?: string;
  position: Position;
  data: any & {
    colors?: NodeColors;
    reactions?: NodeReactions;
  };
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
  reconnectable?: boolean; // Pro feature: enable endpoint reconnection
  data?: any; // Keep for backward compatibility
};

export type NodeType = 'input' | 'output' | 'process' | 'condition' | 'ai' | 'image' | 'text' | 'sticky' | 'shape';

// Pro Features Configuration Interfaces
export interface QuickAddConfig {
  enabled?: boolean;
  showGhostPreview?: boolean;
  defaultSpacing?: number;
  defaultNodeType?: NodeType;
  defaultNodeTemplate?: Partial<Node['data']>;
  onQuickAdd?: (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left', newNode: Node) => void;
}

export interface AdvancedSelectionConfig {
  enabled?: boolean;
  enableMultiSelect?: boolean;
  enableShiftDragSelection?: boolean;
  selectionRectStyle?: React.CSSProperties;
}

export interface CopyPasteConfig {
  enabled?: boolean;
  offsetDistance?: number;
  onCopy?: (node: Node) => void;
  onPaste?: (originalNode: Node, newNode: Node) => void;
}

export interface EdgeReconnectionConfig {
  enabled?: boolean;
  enableAllEdges?: boolean; // If true, makes all edges reconnectable
  visualFeedback?: {
    handleColor?: string;
    previewColor?: string;
    validColor?: string;
    invalidColor?: string;
  };
}

export interface VersionControlConfig {
  enabled?: boolean;
  autoSaveInterval?: number;
  maxSnapshots?: number;
  enableComparison?: boolean;
  onSnapshot?: (snapshot: any) => void;
}

export interface SmartGuidesConfig {
  enabled?: boolean;
  threshold?: number; // Distance threshold for snapping (in canvas units)
  showGuides?: boolean;
  snapToNodes?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  snapToCanvas?: boolean; // Snap to canvas edges
  visualStyle?: {
    guideColor?: string;
    guideOpacity?: number;
    indicatorSize?: number;
  };
}

export interface SmartConnectConfig {
  enabled?: boolean;
  threshold?: number; // Distance threshold for auto-connection
  showPreview?: boolean;
  autoConnect?: boolean; // Automatically create connections when nodes are close
  connectionStyle?: {
    previewColor?: string;
    previewOpacity?: number;
    ghostEdgeStyle?: React.CSSProperties;
  };
}

export interface ProFeaturesConfig {
  quickAdd?: QuickAddConfig;
  advancedSelection?: AdvancedSelectionConfig;
  copyPaste?: CopyPasteConfig;
  versionControl?: VersionControlConfig;
  edgeReconnection?: EdgeReconnectionConfig;
  smartGuides?: SmartGuidesConfig;
  smartConnect?: SmartConnectConfig;
}

// New Node Type Data Interfaces
export interface TextNodeData {
  label: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  textColor: string;
  textDecoration: 'none' | 'underline' | 'strikethrough';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  backgroundColor?: string;
  [key: string]: any;
}

export interface StickyNoteData {
  text: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  [key: string]: any;
}

export interface ShapeNodeData {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow';
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  borderRadius?: number;
  opacity: number;
  [key: string]: any;
}

export interface EmojiReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface NodeReactions {
  [emoji: string]: EmojiReaction;
}

export interface KiteFrameProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeRightClick?: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onCanvasClick?: (event: React.MouseEvent) => void;
  onImageButtonClick?: (nodeId: string) => void;
  onEdgeReconnect?: (edgeId: string, newSource: string, newTarget: string) => void;
  className?: string;
  disablePan?: boolean;
  minZoom?: number;
  maxZoom?: number;
  
  // Pro Features
  proFeatures?: ProFeaturesConfig;
}