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
  zIndex?: number;
};

export type EdgeStyle = {
  stroke?: string;
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
    color?: string;
    fontWeight?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
  style?: EdgeStyle;
  markers?: EdgeMarker;
  markerStart?: boolean | EdgeMarker;
  markerEnd?: boolean | EdgeMarker;
  curvature?: number; // For curved edges
  cornerRadius?: number; // For step edges
  selected?: boolean;
  hidden?: boolean;
  interactable?: boolean;
  reconnectable?: boolean; // Pro feature: enable endpoint reconnection
  zIndex?: number; // Z-index for edge layering
  data?: any; // Keep for backward compatibility
};

export type NodeType = 'basic' | 'input' | 'output' | 'process' | 'condition' | 'ai' | 'image';
export type CanvasObjectType = 'text' | 'sticky' | 'shape';

// Core KiteFrame Node Data Interfaces
export interface BasicNodeData {
  label?: string;
  description?: string;
  colors?: {
    headerBackground?: string;
    bodyBackground?: string;
    borderColor?: string;
    headerTextColor?: string;
    bodyTextColor?: string;
  };
}

export interface ImageNodeData {
  label?: string;
  description?: string;
  src?: string; // Image URL or data URL
  filename?: string; // Original filename
  sourceType?: 'upload' | 'url' | 'data';
  isImageBroken?: boolean;
  imageSize?: { width: number; height: number };
  displayText?: string; // Fallback text when image is missing
  colors?: {
    headerBackground?: string;
    bodyBackground?: string;
    borderColor?: string;
    headerTextColor?: string;
    bodyTextColor?: string;
  };
}

// Typed Node Variants for Type Safety
export type BasicNode = Node & { 
  type: 'basic';
  data: BasicNodeData;
};

export type ImageNode = Node & { 
  type: 'image';
  data: ImageNodeData;
};

// Union type for core library nodes
export type KiteFrameNode = BasicNode | ImageNode;

// Node Creation/Factory Types
export interface NodeTemplate<T = any> {
  type: string;
  defaultData: T;
  defaultStyle?: {
    width?: number;
    height?: number;
  };
  defaultPosition?: Position;
}

export interface BasicNodeTemplate extends NodeTemplate<BasicNodeData> {
  type: 'basic';
}

export interface ImageNodeTemplate extends NodeTemplate<ImageNodeData> {
  type: 'image';
}

// Properties System Types
export interface NodePropertyHandler<T = any> {
  nodeType: string;
  component: React.ComponentType<{
    node: Node & { data: T };
    onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  }>;
}

export interface ImageUploadHandler {
  onImageUpload?: (nodeId: string, file: File) => Promise<string>;
  onImageUrlSet?: (nodeId: string, url: string) => void;
}

// Color Utility Types
export interface ColorUtilities {
  isLightColor: (color: string) => boolean;
  getAppropriateTextColor: (backgroundColor: string) => string;
  calculateLuminance: (color: string) => number;
  getContrastRatio: (color1: string, color2: string) => number;
}

// Component Prop Types for Library Users
export interface BaseNodeComponentProps<TData = any> {
  node: Node & { data: TData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onConnect?: (connection: { source: string; target: string }) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  showHandles?: boolean;
  showResizeHandle?: boolean;
}

export interface BasicNodeComponentProps extends BaseNodeComponentProps<BasicNodeData> {
  node: BasicNode;
}

export interface ImageNodeComponentProps extends BaseNodeComponentProps<ImageNodeData> {
  node: ImageNode;
  onImageUpload?: (nodeId: string, file: File) => Promise<string>;
  onImageUrlSet?: (nodeId: string, url: string) => void;
}

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

// Enhanced Canvas Object Data Interfaces with Comprehensive Styling
export interface TextNodeData {
  label: string;
  text: string;
  // Typography styling
  fontSize: number; // 8-72px
  fontFamily: 'Inter' | 'Arial' | 'Times New Roman' | 'Courier New' | 'Georgia' | 'Verdana' | 'Helvetica';
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  textDecoration: 'none' | 'underline' | 'line-through';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  lineHeight: number;
  letterSpacing: number;
  // Color styling
  textColor: string;
  backgroundColor?: string;
  // Border styling
  borderColor?: string;
  borderWidth?: number; // 0-10px
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number; // 0-50px
  // Effects
  opacity?: number; // 0-1
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  // Padding
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  [key: string]: any;
}

export interface StickyNoteData {
  text: string;
  // Typography styling
  fontSize: number; // 8-24px
  fontFamily: 'Inter' | 'Arial' | 'Times New Roman' | 'Courier New' | 'Georgia' | 'Verdana' | 'Helvetica';
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textDecoration: 'none' | 'underline' | 'line-through';
  lineHeight?: number;
  // Color styling
  backgroundColor: string;
  textColor: string; // Auto-calculated based on background luminance
  autoTextColor?: boolean; // Whether to auto-calculate text color
  // Border styling
  borderColor?: string;
  borderWidth?: number; // 0-5px
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number; // 0-25px
  // Effects
  opacity?: number; // 0-1
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  // Padding
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  [key: string]: any;
}

export interface ShapeNodeData {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'line' | 'arrow';
  // Fill styling
  fillColor: string;
  fillOpacity?: number; // 0-1
  gradient?: {
    enabled: boolean;
    type: 'linear' | 'radial';
    direction: number; // angle in degrees for linear
    colors: Array<{
      color: string;
      position: number; // 0-1
    }>;
  };
  // Stroke/Border styling
  strokeColor: string;
  strokeWidth: number; // 0-20px
  strokeOpacity?: number; // 0-1
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  // Shape-specific styling
  borderRadius?: number; // 0-50px (for rectangles)
  // General effects
  opacity: number; // 0-1
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  // Special properties for lines and arrows
  lineCap?: 'butt' | 'round' | 'square'; // For lines
  arrowSize?: number; // For arrows (1-3 multiplier)
  [key: string]: any;
}

// Styling utility types
export interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
  neutral: string[];
}

export interface StylePreset {
  name: string;
  description?: string;
  textStyles?: Partial<TextNodeData>;
  shapeStyles?: Partial<ShapeNodeData>;
  stickyNoteStyles?: Partial<StickyNoteData>;
}

// Color contrast utility interface
export interface ColorContrast {
  calculateLuminance: (color: string) => number;
  getContrastRatio: (color1: string, color2: string) => number;
  getOptimalTextColor: (backgroundColor: string) => string;
  isLightColor: (color: string) => boolean;
}

// Canvas Objects - not connectable, no handles
export type CanvasObject = {
  id: string;
  type: CanvasObjectType;
  position: Position;
  data: TextNodeData | StickyNoteData | ShapeNodeData;
  style?: { width?: number; height?: number };
  selected?: boolean;
  hidden?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  reactions?: NodeReactions;
  width?: number;
  height?: number;
  zIndex?: number;
};

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
  canvasObjects?: CanvasObject[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onCanvasObjectsChange?: (canvasObjects: CanvasObject[]) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeRightClick?: (event: React.MouseEvent, node: Node) => void;
  onCanvasObjectClick?: (event: React.MouseEvent, canvasObject: CanvasObject) => void;
  onCanvasObjectDoubleClick?: (event: React.MouseEvent, canvasObject: CanvasObject) => void;
  onCanvasObjectRightClick?: (event: React.MouseEvent, canvasObject: CanvasObject) => void;
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