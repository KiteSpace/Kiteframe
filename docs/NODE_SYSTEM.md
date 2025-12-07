# KiteFrame Node System Architecture

This document provides comprehensive documentation for the KiteFrame node system, covering all node types, registration, TypeScript interfaces, data binding, and implementation details.

## Table of Contents

1. [Node Types Overview](#node-types-overview)
2. [Node Registration and Rendering](#node-registration-and-rendering)
3. [TypeScript Types and Interfaces](#typescript-types-and-interfaces)
4. [Data Binding System](#data-binding-system)
5. [TableNode Implementation](#tablenode-implementation)
6. [CompoundNode Implementation](#compoundnode-implementation)
7. [Edge System and Connections](#edge-system-and-connections)
8. [NodeHandles System](#nodehandles-system)

---

## Node Types Overview

KiteFrame supports the following node types defined in `client/src/lib/kiteframe/types.ts`:

```typescript
export type NodeType = 'basic' | 'input' | 'output' | 'process' | 'condition' | 'ai' | 'image' | 'table' | 'form' | 'compound';
export type CanvasObjectType = 'text' | 'sticky' | 'shape';
```

### Workflow Nodes (BasicNode variants)
| Type | Description | Component |
|------|-------------|-----------|
| `input` | Entry points for workflow data | `BasicNode.tsx` |
| `process` | Data processing/transformation steps | `BasicNode.tsx` |
| `condition` | Conditional branching (diamond shape) | `BasicNode.tsx` |
| `output` | Workflow exit points | `BasicNode.tsx` |
| `ai` | AI/LLM processing nodes | `BasicNode.tsx` |

### Data Nodes
| Type | Description | Component |
|------|-------------|-----------|
| `table` | Data tables with API integration and file import | `TableNode.tsx` |
| `form` | Form inputs with table data linking | `FormNode.tsx` |
| `compound` | Multi-component containers (Elementor-style) | `CompoundNode.tsx` |

### Visual Nodes
| Type | Description | Component |
|------|-------------|-----------|
| `image` | Image display nodes | `ImageNode.tsx` |
| `shape` | Vector shapes (rectangle, circle, etc.) | `ShapeNode.tsx` |
| `sticky` | Sticky note annotations | `StickyNote.tsx` |
| `text` | Rich text objects | `TextObject.tsx` |

---

## Node Registration and Rendering

### Node Creation (NodeFactory)

The `NodeFactory` (`client/src/lib/kiteframe/factory/NodeFactory.ts`) provides a registry pattern for creating new nodes with proper defaults:

```typescript
// Factory function type for creating nodes
export type NodeFactoryFunction<TData = any> = (
  id: string,
  position: Position,
  data?: Partial<TData>
) => Node & { data: TData };

// Registry entry for a node type
export interface NodeRegistryEntry<TData = any> {
  type: string;
  factory: NodeFactoryFunction<TData>;
  template: NodeTemplate<TData>;
  displayName?: string;
  description?: string;
  category?: string;
}

// Global node factory registry (singleton)
export const nodeRegistry = new NodeFactoryRegistry();
```

The factory provides methods:
- `register()` - Register a new node type with its factory function
- `getFactory()` - Get the factory function for a node type
- `getTemplate()` - Get the default template for a node type
- `getRegisteredTypes()` - List all registered types
- `getByCategory()` - Get nodes by category

### Node Rendering (KiteFrameCanvas)

The `KiteFrameCanvas` component (`client/src/lib/kiteframe/components/KiteFrameCanvas.tsx`) renders nodes using direct conditional type checks. This approach provides explicit control over each node type's rendering props:

```typescript
// In KiteFrameCanvas.tsx - Node rendering by type
{props.nodes.map((n) => {
  // Text nodes
  if (n.type === "text") {
    return <TextNode key={n.id} node={n} onUpdate={...} onResize={...} />;
  }
  
  // Sticky notes
  if (n.type === "sticky") {
    return <StickyNote key={n.id} node={n} onUpdate={...} onDelete={...} />;
  }
  
  // Shape nodes
  if (n.type === "shape") {
    return <ShapeNode key={n.id} node={n} onUpdate={...} onResize={...} />;
  }
  
  // Image nodes with upload handlers
  if (n.type === "image") {
    return <ImageNode key={n.id} node={n} onImageUpload={...} onImageUrlSet={...} />;
  }
  
  // Table nodes with data callbacks
  if (n.type === "table") {
    return <TableNode key={n.id} node={n} onUpdateTable={...} onCreateNodeFromRow={...} />;
  }
  
  // Form nodes with data linking
  if (n.type === "form") {
    return <FormNode key={n.id} node={n} tables={...} onOpenDataLinkPicker={...} />;
  }
  
  // Compound nodes with subcomponents
  if (n.type === "compound") {
    return <CompoundNode key={n.id} node={n} tables={...} onImageUpload={...} />;
  }
  
  // Default: BasicNode for workflow types (input, output, process, condition, ai)
  return <BasicNode key={n.id} node={n} ... />;
})}
```

Each node type receives specialized props for its functionality (e.g., TableNode gets `onUpdateTable`, CompoundNode gets `tables` for data linking).

### Plugin Integration Layer

The rendering system integrates with the plugin architecture via `PluginProvider`:

```typescript
// From client/src/lib/kiteframe/core/PluginProvider.tsx
// Wraps the canvas to enable plugin hooks
<PluginProvider>
  <KiteFrameCanvas enablePlugins={true} ... />
</PluginProvider>
```

The `CoreNodeIntegration` plugin (`client/src/lib/kiteframe/integration/CoreNodeIntegration.ts`) registers default node and edge handlers with the core system. Plugins can:
- Hook into node lifecycle events (create, update, delete)
- Extend node behavior (e.g., advanced interactions, version control)
- Add custom rendering logic through the extension point system

See `client/src/lib/kiteframe/PLUGIN_ARCHITECTURE_IMPLEMENTATION.md` for full plugin documentation.

### Node Props Pattern

All node components receive a standardized props interface extending `GenericNodeComponentProps`:

```typescript
// From types.ts
export interface GenericNodeComponentProps<T = any> {
  node: Node & { data: T };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onDoubleClick?: (e: React.MouseEvent, node: Node) => void;
  onFocusNode?: (nodeId: string) => void;
  className?: string;
  style?: React.CSSProperties;
  showHandles?: boolean;
  showResizeHandle?: boolean;
  onStartDrag?: (e: React.MouseEvent, node: Node) => void;
  onClick?: (e: React.MouseEvent, node: Node) => void;
  onHandleConnect?: (position: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  viewport?: { x: number; y: number; zoom: number };
  showDragPlaceholder?: boolean;
  isAnyDragActive?: boolean;
}
```

---

## TypeScript Types and Interfaces

### Base Node Type

From `client/src/lib/kiteframe/types.ts`:

```typescript
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
  measuredWidth?: number;  // Transient: DOM-measured width for edge anchoring
  measuredHeight?: number; // Transient: DOM-measured height for edge anchoring
};

export interface BaseNodeData {
  colors?: NodeColors;
  reactions?: NodeReactions;
}

export type NodeColors = {
  headerBackground?: string;
  bodyBackground?: string;
  borderColor?: string;
  textColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
};
```

### TableNodeData

```typescript
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

export interface TableApiConfig {
  enabled: boolean;
  url: string;
  method: TableApiMethod; // 'GET' | 'POST'
  headers?: TableApiHeader[];
  responseDataPath?: string;
  autoRefresh?: boolean;
  autoRefreshIntervalMs?: number;
  authType?: TableApiAuthType; // 'none' | 'apiKey' | 'bearer'
  apiKey?: string;
  apiKeyHeaderName?: string;
}

export interface DataTable {
  id: string;
  name: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  meta?: DataTableMeta;
}

export interface DataTableColumn {
  id: string;
  name: string;
  type?: DataTableColumnType; // 'string' | 'number' | 'boolean' | 'date' | 'unknown'
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

export const TABLE_LIMITS = {
  MAX_ROWS: 500,
  MAX_COLUMNS: 40,
  MAX_CELLS: 10000,
  API_TIMEOUT_MS: 30000,
} as const;
```

### CompoundNodeData

```typescript
export interface CompoundNodeData extends BasicNodeData {
  subcomponents: CompoundSubcomponent[];
  containerPadding?: number;
  gap?: number;
  userResized?: boolean; // Flag to track manual resize
}

export type CompoundSubcomponentType = 'text' | 'image' | 'link' | 'input';

export interface CompoundSubcomponentBase {
  id: string;
  type: CompoundSubcomponentType;
  order: number;
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
    height?: number;
  };
}

export interface CompoundLinkSubcomponent extends CompoundSubcomponentBase {
  type: 'link';
  data: {
    text: string;
    url: string;
    textColor?: string;
    showPreview?: boolean;
    metadata?: {
      title?: string;
      description?: string;
      image?: string;
      favicon?: string;
    };
  };
}

export interface CompoundInputSubcomponent extends CompoundSubcomponentBase {
  type: 'input';
  data: {
    label?: string;
    value: string;
    placeholder?: string;
    inputType?: 'text' | 'number' | 'email' | 'url';
    dataLink?: CompoundInputDataLink;
  };
}

export interface CompoundInputDataLink {
  tableId: string;
  tableNodeId: string;
  tableName: string;
  columnId: string;
  columnName: string;
  rowId: string;
  rowIndex: number;
  displayValue?: string;
}

export type CompoundSubcomponent = 
  | CompoundTextSubcomponent 
  | CompoundImageSubcomponent 
  | CompoundLinkSubcomponent 
  | CompoundInputSubcomponent;
```

### FormNodeData

```typescript
export interface FormNodeData extends BasicNodeData {
  fields: FormNodeField[];
  formTitle?: string;
  showLabels?: boolean;
  layout?: 'vertical' | 'horizontal';
}

export interface FormNodeField {
  id: string;
  label: string;
  value: string;
  dataLink?: FormFieldDataLink;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'email' | 'url' | 'date';
}

export interface FormFieldDataLink {
  tableId: string;
  tableNodeId: string;
  tableName: string;
  columnId: string;
  columnName: string;
  rowId: string;
  rowIndex: number;
  displayValue?: string;
}
```

### ImageNodeData

```typescript
export type ImageFit = 'contain' | 'cover' | 'fill' | 'fit';

export interface ImageNodeData {
  label?: string;
  description?: string;
  src?: string;
  filename?: string;
  sourceType?: 'upload' | 'url' | 'data';
  isImageBroken?: boolean;
  imageSize?: ImageFit;
  displayText?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  autoHeight?: boolean;
  colors?: NodeColors;
}
```

### Edge Type

```typescript
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
  curvature?: number;
  cornerRadius?: number;
  selected?: boolean;
  hidden?: boolean;
  interactable?: boolean;
  reconnectable?: boolean;
  zIndex?: number;
  data?: any;
};
```

---

## Data Binding System

### Overview

The data binding system allows FormNode and CompoundNode inputs to display values from TableNode cells. This creates dynamic data flow between tables and form/compound nodes.

### TableNodeInfo Interface

Tables provide their data to other nodes via the `TableNodeInfo` interface:

```typescript
export interface TableNodeInfo {
  nodeId: string;
  tableId: string;
  tableName: string;
  table?: DataTable;
}
```

### Data Link Structures

Form and Compound nodes use data links to reference table cells:

```typescript
// For Form fields
export interface FormFieldDataLink {
  tableId: string;
  tableNodeId: string;
  tableName: string;
  columnId: string;
  columnName: string;
  rowId: string;
  rowIndex: number;
  displayValue?: string;
}

// For Compound inputs
export interface CompoundInputDataLink {
  tableId: string;
  tableNodeId: string;
  tableName: string;
  columnId: string;
  columnName: string;
  rowId: string;
  rowIndex: number;
  displayValue?: string;
}
```

### DataLinkPicker Component

The `DataLinkPicker` component (`client/src/lib/kiteframe/components/DataLinkPicker.tsx`) provides a UI for selecting table cells to link:

1. User clicks "Link to Data" on a form field or compound input
2. DataLinkPicker opens showing available tables
3. User selects table → column → row
4. Link is established and value is displayed in the input

### Resolving Linked Values

Components resolve linked values by looking up the table data:

```typescript
const getLinkedValue = (dataLink: CompoundInputDataLink | FormFieldDataLink) => {
  const tableInfo = tables.find(t => t.tableId === dataLink.tableId);
  if (!tableInfo?.table) return dataLink.displayValue;
  
  const row = tableInfo.table.rows.find(r => r.id === dataLink.rowId);
  return row?.values[dataLink.columnId] ?? dataLink.displayValue;
};
```

---

## TableNode Implementation

**File**: `client/src/lib/kiteframe/components/TableNode.tsx`

### Key Constants

```typescript
const DEFAULT_TABLE_WIDTH = 560;
const DEFAULT_TABLE_HEIGHT = 300;
const MIN_TABLE_WIDTH = 320;
const MIN_TABLE_HEIGHT = 200;
const MAX_VISIBLE_ROWS = 50;
const MAX_ROW_TO_NODE = 200;
const COLLAPSED_TABLE_HEIGHT = 48;
const MIN_COLLAPSED_WIDTH = 160;
const MAX_COLLAPSED_WIDTH = 300;
```

### Component Props

```typescript
export interface TableNodeComponentProps extends GenericNodeComponentProps<TableNodeData> {
  node: Node & { data: TableNodeData };
  onUpdateTable?: (tableId: string, table: DataTable) => void;
  onCreateNodeFromRow?: (tableId: string, row: Record<string, unknown>, rowIndex: number) => void;
}
```

### API Integration

TableNode supports fetching data from REST APIs with authentication:

```typescript
// API Configuration in TableNodeData
apiConfig?: {
  enabled: boolean;
  url: string;
  method: 'GET' | 'POST';
  headers?: { key: string; value: string }[];
  responseDataPath?: string; // JSONPath to data array
  autoRefresh?: boolean;
  autoRefreshIntervalMs?: number;
  authType?: 'none' | 'apiKey' | 'bearer';
  apiKey?: string;
  apiKeyHeaderName?: string;
}
```

The `handleApiRefresh` function fetches data from the configured API:
1. Builds headers including authentication
2. Makes fetch request with configured method
3. Parses response and extracts data using `responseDataPath`
4. Converts response to DataTable format
5. Updates table via `onUpdateTable` callback

### File Import

TableNode supports importing CSV and JSON files via `utils/dataImport.ts`:

```typescript
// File input handler
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  const content = await file.text();
  let table: DataTable;
  
  if (file.name.endsWith('.csv')) {
    table = parseCSV(content, file.name);
  } else if (file.name.endsWith('.json')) {
    table = parseJSON(content, file.name);
  }
  
  onUpdateTable?.(node.data.tableId, table);
};
```

### Collapsed/Expanded States

TableNode supports collapsing to a compact bar view:

```typescript
const handleToggleCollapse = useCallback(() => {
  if (!isCollapsed) {
    // Store dimensions before collapsing
    onUpdate(node.id, {
      data: { 
        ...node.data, 
        isCollapsed: true,
        expandedWidth: nodeWidth,
        expandedHeight: nodeHeight
      },
      height: COLLAPSED_TABLE_HEIGHT,
    });
  } else {
    // Restore dimensions when expanding
    onUpdate(node.id, {
      data: { ...node.data, isCollapsed: false },
      width: node.data.expandedWidth || DEFAULT_TABLE_WIDTH,
      height: node.data.expandedHeight || DEFAULT_TABLE_HEIGHT,
    });
  }
}, [isCollapsed, nodeWidth, nodeHeight, node, onUpdate]);
```

Collapsed width is calculated based on the table name with padding:
- Minimum: 160px
- Maximum: 300px
- Includes icon, title, and action buttons

### Row-to-Node Creation

Each table row has a button to create a node from that row's data:

```typescript
// Callback signature
onCreateNodeFromRow?: (
  tableId: string, 
  row: Record<string, unknown>, 
  rowIndex: number
) => void;

// Creates a new process node with:
// - Position offset from table node
// - Label from first column value
// - rowData containing all cell values
// - sourceTable references for back-navigation
```

### CSS Positioning

TableNode uses absolute positioning for canvas placement:

```typescript
const outerWrapperStyle: React.CSSProperties = {
  ...style,  // Includes position: 'absolute', left, top from canvas
  width: actualWidth,
  height: actualHeight,
  overflow: 'visible',
};

// Inner container has position: relative for internal overlays
const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  // ... other styles
};
```

---

## CompoundNode Implementation

**File**: `client/src/lib/kiteframe/components/CompoundNode.tsx`

### Key Constants

```typescript
const MIN_COMPOUND_WIDTH = 280;
const MIN_COMPOUND_HEIGHT = 180;
const MAX_COMPOUND_HEIGHT = 600;
const DEFAULT_COMPOUND_WIDTH = 320;
const DEFAULT_COMPOUND_HEIGHT = 280;
```

### Component Props

```typescript
export interface CompoundNodeComponentProps extends GenericNodeComponentProps<CompoundNodeData> {
  node: Node & { data: CompoundNodeData };
  onImageUpload?: (nodeId: string, file: File) => Promise<string>;
  tables?: TableNodeInfo[];
}
```

### Subcomponent Types

CompoundNode contains a vertical stack of subcomponents:

| Type | Description | Key Data Fields |
|------|-------------|-----------------|
| `text` | Rich text with formatting | content, fontSize, fontWeight, fontStyle, textDecoration, textAlign, textColor |
| `image` | Image display | src, alt, height |
| `link` | Hyperlink with optional preview | text, url, textColor, showPreview, metadata |
| `input` | Form input with data linking | label, value, placeholder, inputType, dataLink |

### Elementor-Style Builder

CompoundNode provides a component menu for adding subcomponents:

```typescript
const ComponentMenu: React.FC<ComponentMenuProps> = ({
  isOpen,
  position,
  onAddComponent,
  onClose,
  onDragStart
}) => {
  // Renders floating menu with icons for:
  // - Text (Type icon)
  // - Image (Image icon)
  // - Link (Link icon)
  // - Input (TextCursorInput icon)
};
```

### Drag-to-Reorder Subcomponents

Subcomponents can be reordered by dragging:

```typescript
const [draggingSubcomponent, setDraggingSubcomponent] = useState<string | null>(null);
const [dropTarget, setDropTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);

// On drag end, reorder the subcomponents array
useEffect(() => {
  if (!draggingSubcomponent) return;
  
  const handleMouseUp = () => {
    if (dropTarget) {
      // Reorder subcomponents based on drop position
      const reordered = currentSubs.map((sub, idx) => ({ ...sub, order: idx }));
      onUpdate?.(node.id, { data: { ...node.data, subcomponents: reordered } });
    }
    setDraggingSubcomponent(null);
    setDropTarget(null);
  };
  
  document.addEventListener('mouseup', handleMouseUp);
  return () => document.removeEventListener('mouseup', handleMouseUp);
}, [draggingSubcomponent, dropTarget]);
```

### Dynamic Height Measurement

CompoundNode calculates height based on measured content:

```typescript
const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

// Each subcomponent reports its measured height
const handleHeightChange = useCallback((id: string, height: number) => {
  setMeasuredHeights(prev => {
    if (prev[id] === height) return prev;
    return { ...prev, [id]: height };
  });
}, []);

// Calculate total content height
const measuredContentHeight = useMemo(() => {
  const headerHeight = 48;
  const padding = 24;
  const gap = node.data.gap || 8;
  
  let totalHeight = headerHeight + padding;
  subcomponents.forEach((sub) => {
    const measured = measuredHeights[sub.id] || 60; // fallback
    totalHeight += measured + gap;
  });
  
  return totalHeight;
}, [subcomponents, measuredHeights, node.data.gap]);

// Final height: user-resized OR auto (capped at 600px)
const nodeHeight = hasUserResized
  ? Math.max(explicitHeight, MIN_COMPOUND_HEIGHT)
  : Math.min(Math.max(measuredContentHeight, MIN_COMPOUND_HEIGHT), MAX_COMPOUND_HEIGHT);
```

### Dimension Sync for Edge Positioning

CompoundNode uses `useLayoutEffect` to sync calculated dimensions to the node store before edges render:

```typescript
useLayoutEffect(() => {
  const storedWidth = node.measuredWidth ?? node.width ?? DEFAULT_COMPOUND_WIDTH;
  const storedHeight = node.measuredHeight ?? node.height ?? DEFAULT_COMPOUND_HEIGHT;
  
  const widthDiff = Math.abs(storedWidth - nodeWidth);
  const heightDiff = Math.abs(storedHeight - nodeHeight);
  
  // Only update if dimensions differ significantly (> 1px)
  if ((widthDiff > 1 || heightDiff > 1) && onUpdate) {
    onUpdate(node.id, {
      measuredWidth: nodeWidth,
      measuredHeight: nodeHeight,
    });
  }
}, [node.id, nodeWidth, nodeHeight, node.measuredWidth, node.measuredHeight, node.width, node.height, onUpdate]);
```

### Text Formatting Toolbar

Text subcomponents support Slack-style formatting with keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + B | Bold |
| Ctrl/Cmd + I | Italic |
| Ctrl/Cmd + S | Strikethrough |

The formatting toolbar provides buttons for:
- Bold, Italic, Strikethrough
- Text alignment (Left, Center, Right)
- Font size adjustment
- Text color picker

### Input Data Linking

Input subcomponents can link to table cell values:

```typescript
// When dataLink is set, display linked value
const linkedValue = sub.data.dataLink 
  ? getLinkedValue(sub.data.dataLink) 
  : sub.data.value;

// Link indicator shows source table and column
{sub.data.dataLink && (
  <span className="text-xs text-indigo-500">
    Linked: {sub.data.dataLink.tableName} → {sub.data.dataLink.columnName}
  </span>
)}
```

---

## Edge System and Connections

**File**: `client/src/lib/kiteframe/components/ConnectionEdge.tsx`

### Anchor Point Calculation

Edges connect to nodes via anchor points calculated from node dimensions:

```typescript
const getAnchorPoint = (
  node: Node, 
  handle: 'top' | 'right' | 'bottom' | 'left'
): { x: number; y: number } => {
  const x = node.position.x;
  const y = node.position.y;
  // Use measured dimensions for accurate positioning
  const w = node.measuredWidth ?? node.style?.width ?? node.width ?? 200;
  const h = node.measuredHeight ?? node.style?.height ?? node.height ?? 100;
  
  switch (handle) {
    case 'top':    return { x: x + w / 2, y: y };
    case 'right':  return { x: x + w, y: y + h / 2 };
    case 'bottom': return { x: x + w / 2, y: y + h };
    case 'left':   return { x: x, y: y + h / 2 };
  }
};
```

### ResizeObserver Pipeline

KiteFrameCanvas uses a ResizeObserver to track actual DOM dimensions:

```typescript
// In KiteFrameCanvas.tsx
useEffect(() => {
  const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const nodeId = entry.target.getAttribute('data-node-id');
      if (nodeId) {
        const { width, height } = entry.contentRect;
        // Update node.measuredWidth and node.measuredHeight
        props.onNodesChange?.(nodes.map(n => 
          n.id === nodeId 
            ? { ...n, measuredWidth: width, measuredHeight: height }
            : n
        ));
      }
    });
  });
  
  // Observe all nodes with data-node-id attribute
  containerRef.current.querySelectorAll('.kiteframe-node[data-node-id]')
    .forEach(el => resizeObserver.observe(el));
    
  return () => resizeObserver.disconnect();
}, [props.nodes]);
```

### Edge Types

| Type | Description |
|------|-------------|
| `straight` | Direct line between points |
| `bezier` | Smooth curved line with control points |
| `step` | Right-angle segments (horizontal first) |
| `smoothstep` | Step with rounded corners |
| `curved` | Simple curve with curvature setting |
| `orthogonal` | Auto-routing around obstacles |

---

## NodeHandles System

**File**: `client/src/lib/kiteframe/components/NodeHandles.tsx`

### Handle Positions

```typescript
const HANDLE_POSITIONS = ['top', 'right', 'bottom', 'left'] as const;
type HandlePosition = typeof HANDLE_POSITIONS[number];
```

### Handle Positioning

Handles are positioned at the midpoint of each edge:

```typescript
const getHandleStyle = (position: HandlePosition, width: number, height: number) => {
  const handleSize = 12;
  const offset = handleSize / 2;
  
  switch (position) {
    case 'top':    return { left: width / 2 - offset, top: -offset };
    case 'right':  return { left: width - offset, top: height / 2 - offset };
    case 'bottom': return { left: width / 2 - offset, top: height - offset };
    case 'left':   return { left: -offset, top: height / 2 - offset };
  }
};
```

### Visibility

Handles use `group-hover` for visibility, requiring the parent node to have the `group` class:

```tsx
<div className="kiteframe-node group absolute ...">
  {/* Node content */}
  <NodeHandles node={node} ... />
</div>
```

Handle styling:
```tsx
className={cn(
  "absolute w-3 h-3 rounded-full",
  "bg-blue-500 border-2 border-white",
  "opacity-0 group-hover:opacity-100",
  "cursor-crosshair transition-opacity",
  "hover:scale-125"
)}
```

### Connection Initiation

Clicking a handle initiates edge creation:

```typescript
onMouseDown={(e) => {
  e.stopPropagation();
  onHandleConnect?.(node.id, position);
}}
```

---

## File Reference

| Component | Path |
|-----------|------|
| KiteFrameCanvas | `client/src/lib/kiteframe/components/KiteFrameCanvas.tsx` |
| TableNode | `client/src/lib/kiteframe/components/TableNode.tsx` |
| CompoundNode | `client/src/lib/kiteframe/components/CompoundNode.tsx` |
| FormNode | `client/src/lib/kiteframe/components/FormNode.tsx` |
| ImageNode | `client/src/lib/kiteframe/components/ImageNode.tsx` |
| BasicNode | `client/src/lib/kiteframe/components/BasicNode.tsx` |
| NodeHandles | `client/src/lib/kiteframe/components/NodeHandles.tsx` |
| ConnectionEdge | `client/src/lib/kiteframe/components/ConnectionEdge.tsx` |
| ResizeHandle | `client/src/lib/kiteframe/components/ResizeHandle.tsx` |
| DataLinkPicker | `client/src/lib/kiteframe/components/DataLinkPicker.tsx` |
| Types | `client/src/lib/kiteframe/types.ts` |
| Data Import Utils | `client/src/lib/kiteframe/utils/dataImport.ts` |
| Validation Utils | `client/src/lib/kiteframe/utils/validation.ts` |

---

## Best Practices

### Node Creation
- Use unique IDs (timestamp or UUID)
- Set default dimensions via `width`, `height`, and `style`
- Initialize `data` with required fields for the node type

### Data Binding
- Use `tableId` (not node ID) for referencing table data
- Always check if linked table exists before accessing
- Provide fallback values (e.g., `displayValue`) for missing data

### Performance
- Use `memo()` for node components
- Implement `showDragPlaceholder` for lightweight drag rendering
- Batch updates when modifying multiple nodes

### Edge Alignment
- Nodes must update `measuredWidth`/`measuredHeight` for dynamic sizing
- Use `useLayoutEffect` to sync dimensions before paint
- Parent node must have `position: absolute` for canvas positioning
- Include `group` class for handle hover visibility
