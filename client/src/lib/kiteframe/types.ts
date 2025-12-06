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
  measuredHeight?: number; // Transient: DOM-measured height for edge anchoring (not persisted)
};

export type EdgeStyle = {
  stroke?: string;
  strokeWidth?: number;
  strokeColor?: string;
  strokeDasharray?: string;
  strokeLinecap?: 'butt' | 'round' | 'square';
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

export type NodeType = 'basic' | 'input' | 'output' | 'process' | 'condition' | 'ai' | 'image' | 'table' | 'form' | 'compound';
export type CanvasObjectType = 'text' | 'sticky' | 'shape';

// ============= COMPOUND NODE TYPES =============
// Used for Compound Nodes that contain multiple subcomponents (Elementor-style builder)

export type CompoundSubcomponentType = 'text' | 'image' | 'link' | 'input';

export interface CompoundSubcomponentBase {
  id: string;
  type: CompoundSubcomponentType;
  order: number; // Position in the vertical stack
}

export interface CompoundTextSubcomponent extends CompoundSubcomponentBase {
  type: 'text';
  data: {
    content: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'line-through';
    textAlign?: 'left' | 'center' | 'right';
    textColor?: string;
  };
}

export interface CompoundImageSubcomponent extends CompoundSubcomponentBase {
  type: 'image';
  data: {
    src?: string;
    alt?: string;
    height?: number; // Fixed height for the image in the stack
  };
}

export interface CompoundLinkSubcomponent extends CompoundSubcomponentBase {
  type: 'link';
  data: {
    text: string;
    url: string;
    textColor?: string;
    showPreview?: boolean; // Show rich link preview instead of text
    metadata?: {
      title?: string;
      description?: string;
      image?: string;
      favicon?: string;
    };
  };
}

// Data link for compound input - links input value to a table cell
export interface CompoundInputDataLink {
  tableId: string;      // ID of the source table node
  tableNodeId: string;  // Node ID of the table (for focusing)
  tableName: string;    // Display name of the table
  columnId: string;     // Column ID in the table
  columnName: string;   // Display name of the column
  rowId: string;        // Row ID in the table
  rowIndex: number;     // Row index for display
  displayValue?: string; // Cached display value from the linked cell
}

export interface CompoundInputSubcomponent extends CompoundSubcomponentBase {
  type: 'input';
  data: {
    label?: string;
    value: string;
    placeholder?: string;
    inputType?: 'text' | 'number' | 'email' | 'url';
    dataLink?: CompoundInputDataLink; // Optional link to table cell
  };
}

export type CompoundSubcomponent = 
  | CompoundTextSubcomponent 
  | CompoundImageSubcomponent 
  | CompoundLinkSubcomponent 
  | CompoundInputSubcomponent;

// ============= DATA TABLE TYPES =============
// Used for Table Nodes to store and display imported CSV/JSON data

export type DataTableColumnType = 'string' | 'number' | 'boolean' | 'date' | 'unknown';

export interface DataTableColumn {
  id: string;
  name: string;
  type?: DataTableColumnType;
  width?: number;
}

export interface DataTableRow {
  id: string;
  values: Record<string, string | number | boolean | null>;
}

export interface DataTableMeta {
  primaryColumnId?: string;
  sourceFileName?: string;
  totalRowCount?: number;
  importedAt?: string;
}

export interface DataTable {
  id: string;
  name: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  meta?: DataTableMeta;
}

// Data binding types for linking nodes to table rows
export interface TableRowBinding {
  type: 'tableRow';
  tableId: string;
  rowId: string;
}

export type NodeFieldBindingMode = 'lookupRow';

export interface NodeFieldBinding {
  id: string;
  nodeId: string;
  fieldKey: string;
  mode: NodeFieldBindingMode;
  tableId: string;
  rowId: string;
}

export interface DataBindingsState {
  rowBindings: TableRowBinding[];
  fieldBindings: NodeFieldBinding[];
}

// Open Graph metadata for link previews
export interface OgMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

// Hyperlink type for node links
export interface NodeHyperlink {
  id: string;
  text: string;
  url: string;
  showPreview?: boolean;
  metadata?: OgMetadata;
}

// Legacy single hyperlink type (for backward compatibility)
export interface LegacyNodeHyperlink {
  text: string;
  url: string;
  showPreview?: boolean;
  metadata?: OgMetadata;
}

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
  // Border styling for nodes
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderWidth?: number;
  // Hyperlinks displayed below body text (array for multiple links)
  hyperlinks?: NodeHyperlink[];
  // Legacy single hyperlink (for backward compatibility)
  hyperlink?: LegacyNodeHyperlink;
  // Source table tracking - when node is created from a table row
  sourceTable?: string; // Original table ID (legacy)
  sourceTableNodeId?: string; // Table node ID for focusing
  sourceTableName?: string; // Display name of source table
  sourceRowIndex?: number; // Row index in source table
  rowData?: Record<string, unknown>; // Original row data
}

// Image fit type definition
export type ImageFit = 'contain' | 'cover' | 'fill' | 'fit'; // fit maps to scale-down

export interface ImageNodeData {
  label?: string;
  description?: string;
  src?: string; // Image URL or data URL
  filename?: string; // Original filename
  sourceType?: 'upload' | 'url' | 'data';
  isImageBroken?: boolean;
  imageSize?: ImageFit; // Image sizing mode
  displayText?: string; // Fallback text when image is missing
  naturalWidth?: number; // Natural width of the image
  naturalHeight?: number; // Natural height of the image
  autoHeight?: boolean; // Auto-adjust height based on aspect ratio (default true)
  colors?: {
    headerBackground?: string;
    bodyBackground?: string;
    borderColor?: string;
    headerTextColor?: string;
    bodyTextColor?: string;
  };
}

// Table Node Data - extends BasicNodeData with table-specific properties
export interface TableNodeData extends BasicNodeData {
  tableId: string;
  table?: DataTable;
  previewRowCount?: number;
  previewColumnCount?: number;
  showRowNumbers?: boolean;
  isPanelOpen?: boolean;
  isCollapsed?: boolean; // Collapsed view shows only name and expand button
}

// Data-backed Node Data - nodes created from table rows
export interface DataBackedNodeData extends BasicNodeData {
  sourceTableId: string;
  sourceRowId: string;
  boundFields?: Record<string, string>;
  autoSync?: boolean;
}

// ============= FORM NODE TYPES =============
// Used for Form Nodes with input fields that can be typed or linked to table data

// Data link reference - links a form field to a specific table cell
export interface FormFieldDataLink {
  tableId: string;      // ID of the source table node
  columnId: string;     // Column ID in the table
  rowId: string;        // Row ID in the table
  displayValue?: string; // Cached display value from the linked cell
}

// Individual form field definition
export interface FormNodeField {
  id: string;           // Unique field identifier
  label: string;        // Field label displayed to the user
  value: string;        // Current text value (used when not linked)
  dataLink?: FormFieldDataLink; // Optional link to table cell
  placeholder?: string; // Placeholder text when empty
  required?: boolean;   // Whether field is required
  type?: 'text' | 'number' | 'email' | 'url' | 'date'; // Input type hint
}

// Form Node Data - extends BasicNodeData with form-specific properties
export interface FormNodeData extends BasicNodeData {
  fields: FormNodeField[];
  formTitle?: string;   // Optional form title/header
  showLabels?: boolean; // Whether to show field labels (default true)
  layout?: 'vertical' | 'horizontal'; // Field layout direction
}

// Compound Node Data - container for multiple subcomponents (Elementor-style builder)
export interface CompoundNodeData extends BasicNodeData {
  subcomponents: CompoundSubcomponent[];
  containerPadding?: number;
  gap?: number; // Gap between subcomponents
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

export type TableNode = Node & {
  type: 'table';
  data: TableNodeData;
};

export type DataBackedNode = Node & {
  type: 'basic';
  data: DataBackedNodeData;
};

export type FormNode = Node & {
  type: 'form';
  data: FormNodeData;
};

export type CompoundNode = Node & {
  type: 'compound';
  data: CompoundNodeData;
};

// Union type for core library nodes
export type KiteFrameNode = BasicNode | ImageNode | TableNode | DataBackedNode | FormNode | CompoundNode;

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

export interface TableNodeTemplate extends NodeTemplate<TableNodeData> {
  type: 'table';
}

export interface FormNodeTemplate extends NodeTemplate<FormNodeData> {
  type: 'form';
}

export interface CompoundNodeTemplate extends NodeTemplate<CompoundNodeData> {
  type: 'compound';
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
  onFocusNode?: (nodeId: string) => void; // Focus/pan canvas to a specific node
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
  onStartDrag?: (e: React.MouseEvent, node: Node) => void;
  onClick?: (e: React.MouseEvent, node: Node) => void;
  onHandleConnect?: (position: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  viewport?: { x: number; y: number; zoom: number };
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
  fontWeight: number | 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
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
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderRadius?: number; // 0-50px
  // Hyperlink support for text objects
  hyperlink?: {
    url: string;
    showPreview: boolean;
    showText: boolean;
    metadata?: {
      title?: string;
      description?: string;
      favicon?: string;
      image?: string;
      siteName?: string;
    };
  };
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
  fontWeight: number | 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textDecoration: 'none' | 'underline' | 'line-through';
  lineHeight?: number;
  letterSpacing?: number;
  // Color styling
  backgroundColor: string;
  textColor: string; // Auto-calculated based on background luminance
  autoTextColor?: boolean; // Whether to auto-calculate text color
  // Border styling
  borderColor?: string;
  borderWidth?: number; // 0-5px
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
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
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'line' | 'arrow' | 'polygon';
  // Fill styling
  fillColor: string;
  fillOpacity?: number; // 0-1
  fillStyle?: 'solid' | 'transparent' | 'none'; // solid=100%, transparent=30%, none=0%
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
  strokeStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  // Text content
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: 'Inter' | 'Arial' | 'Times New Roman' | 'Courier New' | 'Georgia' | 'Verdana' | 'Helvetica';
  fontWeight?: number | 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
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
  // Endpoint properties for lines and arrows (relative to shape position)
  startPoint?: { x: number; y: number }; // Start endpoint (relative to position)
  endPoint?: { x: number; y: number }; // End endpoint (relative to position)
  startConnectedTo?: string; // Node ID if connected to a node
  endConnectedTo?: string; // Node ID if connected to a node
  startHandlePosition?: 'top' | 'right' | 'bottom' | 'left'; // Which handle on the node
  endHandlePosition?: 'top' | 'right' | 'bottom' | 'left'; // Which handle on the node
  // Freeform shape properties
  points?: { x: number; y: number }[]; // Vertices for freeform polygon
  isClosed?: boolean; // Whether the freeform shape is closed (polygon) or open (polyline)
  isCreating?: boolean; // Whether the freeform shape is being created (points being added)
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
  disableWheelZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
  
  // Pro Features
  proFeatures?: ProFeaturesConfig;
}