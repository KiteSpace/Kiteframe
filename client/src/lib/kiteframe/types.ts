export type Position = { x: number; y: number };

export type NodeColors = {
  headerBackground?: string;
  bodyBackground?: string;
  borderColor?: string;
  textColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
};

// Node status type for task tracking
export type NodeStatus = 'todo' | 'inprogress' | 'done';

// PRD reference for linking nodes to PRD sections
export interface PRDRef {
  workflowId: string;
  sectionId: string;
  projectId?: string;
}

// Base node data with common properties shared by all node types
export interface BaseNodeData {
  colors?: NodeColors;
  reactions?: NodeReactions;
  status?: NodeStatus;
  prdRefs?: PRDRef[];
}

// Node type uses 'any' for backward compatibility
// Use TypedNode or specific node types (BasicNode, TableNode, etc.) for type-safe code
export interface NodeMeta {
  beta?: boolean;
  visionGenerated?: boolean;
  source?: 'heuristic' | 'vision' | 'user';
  confidence?: 'low' | 'medium' | 'high';
}

export type Node = {
  id: string;
  type?: string;
  position: Position;
  data: any & BaseNodeData;
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
  measuredWidth?: number;
  measuredHeight?: number;
  meta?: NodeMeta;
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

export type NodeType = 'input' | 'output' | 'process' | 'condition' | 'ai' | 'image' | 'table' | 'form' | 'compound' | 'webview' | 'code' | 'render';
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
    columnBinding?: { columnId: string; columnName: string }; // Template column binding
  };
}

export interface CompoundImageSubcomponent extends CompoundSubcomponentBase {
  type: 'image';
  data: {
    src?: string;
    alt?: string;
    height?: number; // Fixed height for the image in the stack
    columnBinding?: { columnId: string; columnName: string }; // Template column binding
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
    textColumnBinding?: { columnId: string; columnName: string }; // Template column binding for text
    urlColumnBinding?: { columnId: string; columnName: string };  // Template column binding for URL
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
    columnBinding?: { columnId: string; columnName: string }; // Template column binding
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
  lastRefreshedAt?: string;
  wasTruncated?: boolean;
  truncationMessage?: string;
}

export type TableApiMethod = 'GET' | 'POST';

export interface TableApiHeader {
  key: string;
  value: string;
}

export type TableApiAuthType = 'none' | 'apiKey' | 'bearer';

export interface TableApiConfig {
  enabled: boolean;
  url: string;
  method: TableApiMethod;
  headers?: TableApiHeader[];
  responseDataPath?: string;
  autoRefresh?: boolean;
  autoRefreshIntervalMs?: number;
  authType?: TableApiAuthType;
  apiKey?: string;
  apiKeyHeaderName?: string;
}

export const TABLE_LIMITS = {
  MAX_ROWS: 500,
  MAX_COLUMNS: 40,
  MAX_CELLS: 10000,
  API_TIMEOUT_MS: 30000,
} as const;

export interface DataTable {
  id: string;
  name: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  meta?: DataTableMeta;
}

// ============= ROW NODE TYPES =============
// Enhanced row-to-node binding for nodes created from table rows

// Row binding metadata for nodes created from table rows
export interface RowBindingMeta {
  tableId: string;       // ID of the source table
  tableNodeId: string;   // Node ID of the table (for focusing/navigation)
  tableName: string;     // Display name of the table
  rowId: string;         // Unique row ID in the table
  rowIndex: number;      // Row index for display (0-based)
}

// Display configuration for row data cards
export interface RowDisplayConfig {
  primaryColumnId?: string;   // Column to use as card title
  visibleColumnIds?: string[]; // Columns to display (up to ~6)
  showRowIndex?: boolean;     // Whether to show row number
  compactMode?: boolean;      // Use compact single-line display
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
  // Auto-size mode: when true, node height grows to fit content (with min height)
  autoSize?: boolean;
  // Border styling for nodes
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderWidth?: number;
  // Hyperlinks displayed below body text (array for multiple links)
  hyperlinks?: NodeHyperlink[];
  // Legacy single hyperlink (for backward compatibility)
  hyperlink?: LegacyNodeHyperlink;
  // Source table tracking - when node is created from a table row (legacy fields)
  sourceTable?: string; // Original table ID (legacy)
  sourceTableNodeId?: string; // Table node ID for focusing
  sourceTableName?: string; // Display name of source table
  sourceRowIndex?: number; // Row index in source table
  rowData?: Record<string, unknown>; // Original row data
  // Enhanced row binding - structured metadata for table row nodes
  rowBinding?: RowBindingMeta;
  rowDisplay?: RowDisplayConfig;
  rowValues?: Record<string, string | number | boolean | null>; // Typed row values
  // Semantic workflow generation fields (for nodes generated from Figma semantic data)
  semanticType?: string; // Type of semantic element this node represents (heading, button, input, etc.)
  figmaElementId?: string; // ID of the original Figma element
  workflowGroupId?: string; // ID of the workflow group this node belongs to
}

// Image fit type definition
export type ImageFit = 'contain' | 'cover' | 'fill' | 'fit'; // fit maps to scale-down

// Figma semantic metadata import (for Figma-imported image nodes)
import type { FigmaSemanticMetadata } from '../integration/figmaSemanticTypes';

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
  // Figma import metadata
  figmaId?: string;
  figmaType?: string;
  figmaPageName?: string;
  figmaFileKey?: string; // Source Figma file key for multi-file tracking
  originalWidth?: number;
  originalHeight?: number;
  // Semantic metadata extracted from Figma node tree (for AI workflows)
  figmaSemantic?: FigmaSemanticMetadata | null;
  // Reference frame flag - when true, frame is excluded from workflow/PRD generation
  isReferenceFrame?: boolean;
  // Import source tracking - identifies where the image originated from
  importedFrom?: 'figma' | 'upload' | 'url' | string;
}

// Table Node Data - extends BasicNodeData with table-specific properties
export interface TableNodeData extends BasicNodeData {
  tableId: string;
  table?: DataTable;
  previewRowCount?: number;
  previewColumnCount?: number;
  showRowNumbers?: boolean;
  isPanelOpen?: boolean;
  isCollapsed?: boolean;
  apiConfig?: TableApiConfig;
  isLoading?: boolean;
  lastError?: string;
}

// ============= WEBVIEW NODE TYPES =============
// Used for embedding external web content (Figma, Replit, Framer, etc.)

export interface WebviewNodeData extends BasicNodeData {
  url?: string;              // The URL to embed
  title?: string;            // Display title for the node
  favicon?: string;          // Favicon URL (auto-detected or custom)
  serviceName?: string;      // Detected service name (Figma, Replit, etc.)
  serviceIcon?: string;      // Known service icon identifier
  isLoading?: boolean;       // Whether the iframe is loading
  loadError?: string;        // Error message if iframe fails to load
  showControls?: boolean;    // Show toolbar with refresh, fullscreen, etc.
  sandbox?: string;          // Iframe sandbox attributes
}

// Data-backed Node Data - nodes created from table rows with data synchronization
// Uses sourceTable for consistency with BasicNodeData (not sourceTableId)
export interface DataBackedNodeData extends BasicNodeData {
  sourceTable: string;    // Table ID (consistent with BasicNodeData.sourceTable)
  sourceRowId: string;    // Row ID in the source table
  boundFields?: Record<string, string>; // Field-to-column bindings (reserved)
  autoSync?: boolean;     // Auto-sync flag (reserved for future use)
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

// Form field type - all available input types
export type FormFieldType = 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'url' 
  | 'date'
  | 'textarea'
  | 'checkbox'
  | 'toggle'
  | 'dropdown'
  | 'radio';

// Dropdown/Radio option definition
export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
}

// Individual form field definition
export interface FormNodeField {
  id: string;           // Unique field identifier
  label: string;        // Field label displayed to the user
  value: string;        // Current text value (used when not linked)
  dataLink?: FormFieldDataLink; // Optional link to table cell
  placeholder?: string; // Placeholder text when empty
  required?: boolean;   // Whether field is required
  type?: FormFieldType; // Input type
  checked?: boolean;    // For checkbox/toggle fields
  options?: FormFieldOption[]; // For dropdown/radio fields
  selectedOptionId?: string;   // For dropdown/radio - which option is selected
}

// Form Node Data - extends BasicNodeData with form-specific properties
export interface FormNodeData extends BasicNodeData {
  fields: FormNodeField[];
  formTitle?: string;   // Optional form title/header
  showLabels?: boolean; // Whether to show field labels (default true)
  layout?: 'vertical' | 'horizontal'; // Field layout direction
  // Linked table context - set when a TableNode→FormNode edge is created
  linkedTableId?: string;       // ID of the linked table (tableId from TableNodeData)
  linkedTableNodeId?: string;   // Node ID of the linked TableNode (for navigation/focusing)
  linkedTableName?: string;     // Display name of the linked table
  linkedRowIndex?: number;      // 1-based row index when form is created from table row
}

// Compound Node Data - container for multiple subcomponents (Elementor-style builder)
export interface CompoundNodeData extends BasicNodeData {
  subcomponents: CompoundSubcomponent[];
  containerPadding?: number;
  gap?: number; // Gap between subcomponents
  userResized?: boolean; // Flag to track if user has manually resized the node
  sourceRowId?: string;       // Row ID when generated from template
  sourceTableId?: string;     // Table ID when generated from template
  sourceTemplateId?: string;  // Template ID when generated from template
}

// ============= CODE NODE TYPES =============
// Used for Code Nodes with integrated editor and output display

export type CodeLanguage = 'javascript' | 'python' | 'html';
export type CodeOutputType = 'console' | 'html';

// Output result from code execution
export interface CodeExecutionResult {
  success: boolean;
  output?: string;        // Console output (stdout)
  error?: string;         // Error message if execution failed
  returnValue?: unknown;  // The final expression result
  executedAt?: string;    // ISO timestamp of last execution
  htmlOutput?: string;    // HTML content for rendering in HTML output mode
}

// Input variable binding - links to connected Form/Table node data
export interface CodeInputBinding {
  sourceNodeId: string;   // ID of the connected Form or Table node
  sourceType: 'form' | 'table';
  variableName: string;   // Variable name to inject into code context
}

// Code Node Data - extends BasicNodeData with code editor properties
export interface CodeNodeData extends BasicNodeData {
  code: string;                           // The source code
  language: CodeLanguage;                 // Programming language
  outputType?: CodeOutputType;            // Output mode: console (default) or html
  lastResult?: CodeExecutionResult;       // Last execution result
  inputBindings?: CodeInputBinding[];     // Bound input variables from connected nodes
  autoRun?: boolean;                      // Auto-run when inputs change
  showOutput?: boolean;                   // Whether output panel is visible
  outputHeight?: number;                  // Height of output panel in pixels
}

// ============= SAVED COMPOUND TEMPLATES =============
// Templates for saving and reusing CompoundNode layouts with column bindings

// Column binding reference - links a subcomponent field to a table column
// At generation time, the column value from each row is substituted into the subcomponent
export interface TemplateColumnBinding {
  columnId: string;     // Column ID to bind to
  columnName: string;   // Column name for display
}

// Template subcomponent types - similar to CompoundSubcomponent but with optional column bindings
export interface TemplateSubcomponentBase {
  id: string;
  type: CompoundSubcomponentType;
  order: number;
}

export interface TemplateTextSubcomponent extends TemplateSubcomponentBase {
  type: 'text';
  data: {
    content: string;  // Static content or placeholder
    columnBinding?: TemplateColumnBinding; // If bound, content is replaced with column value
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'line-through';
    textAlign?: 'left' | 'center' | 'right';
    textColor?: string;
  };
}

export interface TemplateImageSubcomponent extends TemplateSubcomponentBase {
  type: 'image';
  data: {
    src?: string;       // Static image URL
    columnBinding?: TemplateColumnBinding; // If bound, src is replaced with column value (URL)
    alt?: string;
    height?: number;
  };
}

export interface TemplateLinkSubcomponent extends TemplateSubcomponentBase {
  type: 'link';
  data: {
    text: string;       // Static text or placeholder
    url: string;        // Static URL or placeholder
    textColumnBinding?: TemplateColumnBinding;  // If bound, text is replaced with column value
    urlColumnBinding?: TemplateColumnBinding;   // If bound, url is replaced with column value
    textColor?: string;
    showPreview?: boolean;
  };
}

export interface TemplateInputSubcomponent extends TemplateSubcomponentBase {
  type: 'input';
  data: {
    label?: string;
    value: string;
    columnBinding?: TemplateColumnBinding; // If bound, value is pre-filled with column value
    placeholder?: string;
    inputType?: 'text' | 'number' | 'email' | 'url';
  };
}

export type TemplateSubcomponent =
  | TemplateTextSubcomponent
  | TemplateImageSubcomponent
  | TemplateLinkSubcomponent
  | TemplateInputSubcomponent;

// Template metadata for saved templates
export interface SavedTemplateMetadata {
  createdAt: string;    // ISO date string
  updatedAt?: string;   // ISO date string
  thumbnail?: string;   // Base64 or URL of thumbnail preview
  tags?: string[];      // User-defined tags for organization
  usageCount?: number;  // Track how many times the template has been used
}

// The main saved compound template type
export interface SavedCompoundTemplate {
  id: string;           // Unique template ID
  name: string;         // User-defined template name
  description?: string; // Optional description
  subcomponents: TemplateSubcomponent[]; // Subcomponents with optional column bindings
  containerPadding?: number;
  gap?: number;
  defaultWidth?: number;  // Default node width when generated
  defaultHeight?: number; // Default node height when generated
  colors?: NodeColors;    // Default colors for generated nodes
  metadata: SavedTemplateMetadata;
}

// Template store for project-level template management
export interface TemplateStore {
  templates: SavedCompoundTemplate[];
  version: number; // For migration purposes
}

// Typed Node Variants for Type Safety
export type ProcessNode = Node & { 
  type: 'process';
  data: BasicNodeData;
};

// Alias for backward compatibility
export type BasicNode = ProcessNode;

export type ImageNode = Node & { 
  type: 'image';
  data: ImageNodeData;
};

export type TableNode = Node & {
  type: 'table';
  data: TableNodeData;
};

export type DataBackedNode = Node & {
  type: 'process';
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

export type CodeNode = Node & {
  type: 'code';
  data: CodeNodeData;
};

// Union type for core library nodes - use this for type-safe node handling
// This is the preferred type when you need full type safety on node.data
export type KiteFrameNode = ProcessNode | ImageNode | TableNode | DataBackedNode | FormNode | CompoundNode | CodeNode;

// Alias for type-safe node operations (same as KiteFrameNode)
export type TypedNode = KiteFrameNode;

// Union of all node data types for type guards and validation
export type NodeDataUnion = 
  | BasicNodeData 
  | ImageNodeData 
  | TableNodeData 
  | DataBackedNodeData 
  | FormNodeData 
  | CompoundNodeData
  | CodeNodeData;

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

export interface ProcessNodeTemplate extends NodeTemplate<BasicNodeData> {
  type: 'process';
}

// Alias for backward compatibility
export type BasicNodeTemplate = ProcessNodeTemplate;

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

export interface CodeNodeTemplate extends NodeTemplate<CodeNodeData> {
  type: 'code';
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
  isStatusEnabled?: boolean; // Enable status badge in footer
  onStatusClick?: (nodeId: string) => void; // Callback when status badge is clicked
  readOnly?: boolean; // Disable interactions in read-only mode
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
  showDragPlaceholder?: boolean;
  isAnyDragActive?: boolean; // Hide handles on ALL nodes when any drag is active
}

// ============= UNIVERSAL NODE COMPONENT PROPS =============
// Shared props interface for all interactive node types
// All node components should extend or implement these callbacks for consistency

export interface GenericNodeComponentProps<TData = any> extends BaseNodeComponentProps<TData> {
  onStartDrag?: (e: React.MouseEvent, node: Node) => void;
  onClick?: (e: React.MouseEvent, node: Node) => void;
  onHandleConnect?: (position: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  viewport?: { x: number; y: number; zoom: number };
  showDragPlaceholder?: boolean;
  isAnyDragActive?: boolean; // Hide handles on ALL nodes when any drag is active
}

// Table info for data linking in form/compound nodes
export interface TableNodeInfo {
  nodeId: string;
  tableId: string;
  tableName: string;
  table?: DataTable;
}

export interface TableNodeComponentProps extends GenericNodeComponentProps<TableNodeData> {
  node: Node & { data: TableNodeData };
  onUpdateTable?: (tableId: string, table: DataTable) => void;
  onCreateNodeFromRow?: (tableId: string, row: Record<string, unknown>, rowIndex: number) => void;
  savedTemplates?: SavedCompoundTemplate[];
  onGenerateFromTemplate?: (tableId: string, template: SavedCompoundTemplate, selectedRowIds?: string[]) => void;
}

export interface FormNodeComponentProps extends GenericNodeComponentProps<FormNodeData> {
  node: Node & { data: FormNodeData };
  tables?: DataTable[];
  onOpenDataLinkPicker?: (fieldId: string, currentLink?: FormFieldDataLink) => void;
  onLinkTable?: (nodeId: string) => void;
  onUnlinkTable?: (nodeId: string) => void;
  onUpdateTableCell?: (tableId: string, rowId: string, columnId: string, value: string) => void;
}

export interface CompoundNodeComponentProps extends GenericNodeComponentProps<CompoundNodeData> {
  node: Node & { data: CompoundNodeData };
  onImageUpload?: (nodeId: string, file: File) => Promise<string>;
  tables?: TableNodeInfo[];
  onSaveAsTemplate?: (nodeId: string, templateName: string, description?: string) => void;
}

export interface WebviewNodeComponentProps extends GenericNodeComponentProps<WebviewNodeData> {
  node: Node & { data: WebviewNodeData };
  onOpenFullscreen?: (nodeId: string) => void;
  onConvertToLink?: (nodeId: string, url: string, title: string) => void;
}

// Data source info for code node input collection
export interface CodeNodeDataSource {
  nodeId: string;
  nodeType: 'form' | 'table';
  nodeName?: string;  // Display name of the connected node
  variableName?: string;  // User-defined variable name for accessing data (tables only)
  data: Record<string, unknown>;  // Key-value pairs from form fields or table rows
}

export interface CodeNodeComponentProps extends GenericNodeComponentProps<CodeNodeData> {
  node: Node & { data: CodeNodeData };
  connectedDataSources?: CodeNodeDataSource[];  // Data from connected Form/Table nodes
  onExecuteCode?: (nodeId: string, code: string, language: CodeLanguage, inputs: Record<string, unknown>) => Promise<CodeExecutionResult>;
  onCreateRenderNode?: (codeNodeId: string) => void;  // Create a connected RenderNode for HTML output
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