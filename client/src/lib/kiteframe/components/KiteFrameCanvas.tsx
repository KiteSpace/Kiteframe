import React, { useEffect, useRef, useState } from 'react';
import '../styles/kiteframe.css';
import '../styles/enhanced-selection.css';
import type { Node, Edge, NodeType, CanvasObject, CanvasObjectType, ProFeaturesConfig, QuickAddConfig } from '../types';
import { clientToWorld, zoomAroundPoint } from '../utils/geometry';
import { NodeHandles } from './NodeHandles';
import { ConnectionEdge } from './ConnectionEdge';
import { SnapGuides } from './SnapGuides';
import { EdgeHandles } from './EdgeHandles';
import { calculateSnapPosition, defaultSnapSettings, type SnapGuide } from '../utils/snapUtils';
import { ProFeaturesManager } from '../plugins/pro/ProFeaturesManager';
import { KiteFrameCore, kiteFrameCore } from '../core/KiteFrameCore';
import { TextNode } from './TextNode';
import { StickyNote } from './StickyNote';
import { ShapeNode } from './ShapeNode';
import { TextObject } from './TextObject';
import { StickyNoteObject } from './StickyNoteObject';
import { ShapeObject } from './ShapeObject';
import { EmojiReactions } from './EmojiReactions';
import { AnimatedConnectionPreview, type AnimationConfig } from './AnimatedConnectionPreview';
import { ChevronDown, ChevronUp, X, ExternalLink, List, Type } from 'lucide-react';

// Floating workflow name input component
interface WorkflowLink {
  id: string;
  text: string;
  url: string;
}

interface WorkflowMetadata {
  name: string;
  description: string;
  links: WorkflowLink[];
  linksFormat: 'bulleted' | 'text';
  categories: string[];
}

interface WorkflowNameInputProps {
  name: string;
  onChange: (name: string) => void;
  metadata?: WorkflowMetadata;
  onMetadataChange?: (metadata: WorkflowMetadata) => void;
}

const WorkflowNameInput: React.FC<WorkflowNameInputProps> = ({ 
  name, 
  onChange, 
  metadata,
  onMetadataChange 
}) => {
  const [mode, setMode] = useState<'collapsed' | 'editing-name' | 'expanded'>('collapsed');
  const [inputValue, setInputValue] = useState(name);
  const [formData, setFormData] = useState<WorkflowMetadata>(metadata || {
    name,
    description: '',
    links: [],
    linksFormat: 'text',
    categories: []
  });
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({ text: '', url: '' });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  const categorySuggestions = [
    'User Experience', 'Feature Planning', 'Brainstorming', 
    'Collaboration', 'Workshop', 'Design System'
  ];

  // Update local state when props change
  useEffect(() => {
    setInputValue(name);
    setFormData(prev => ({ ...prev, name }));
  }, [name]);

  useEffect(() => {
    if (metadata) {
      setFormData(metadata);
    }
  }, [metadata]);

  // Handle keydown events for F2 and form interactions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && mode === 'collapsed') {
        e.preventDefault();
        setMode('editing-name');
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (mode === 'expanded' && formRef.current && !formRef.current.contains(e.target as HTMLElement)) {
        handleSaveForm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mode]);

  const handleStartNameEdit = () => {
    setMode('editing-name');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFinishNameEdit = () => {
    const newName = inputValue.trim() || 'Untitled Workflow';
    setMode('collapsed');
    onChange(newName);
    setFormData(prev => ({ ...prev, name: newName }));
  };

  const handleExpandForm = () => {
    setMode('expanded');
  };

  const handleSaveForm = () => {
    setMode('collapsed');
    onMetadataChange?.(formData);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishNameEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(name);
      setMode('collapsed');
    }
  };

  const handleAddCategory = () => {
    const category = newCategory.trim();
    if (category && formData.categories.length < 5 && !formData.categories.includes(category)) {
      setFormData(prev => ({ ...prev, categories: [...prev.categories, category] }));
      setNewCategory('');
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    } else if (e.key === 'Tab' && newCategory) {
      const suggestion = categorySuggestions.find(s => 
        s.toLowerCase().startsWith(newCategory.toLowerCase())
      );
      if (suggestion) {
        e.preventDefault();
        setNewCategory(suggestion);
        setTimeout(() => handleAddCategory(), 0);
      }
    }
  };

  const handleRemoveCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index)
    }));
  };

  const handleEditCategory = (index: number, value: string) => {
    if (editingCategory === formData.categories[index]) {
      setFormData(prev => ({
        ...prev,
        categories: prev.categories.map((cat, i) => i === index ? value : cat)
      }));
      setEditingCategory(null);
    } else {
      setEditingCategory(formData.categories[index]);
    }
  };

  const handleAddLink = () => {
    if (newLink.text.trim() && newLink.url.trim()) {
      setFormData(prev => ({
        ...prev,
        links: [...prev.links, { ...newLink, id: Date.now().toString() }]
      }));
      setNewLink({ text: '', url: '' });
    }
  };

  const handleRemoveLink = (id: string) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter(link => link.id !== id)
    }));
  };

  // Display mode - show card with content
  if (mode === 'collapsed') {
    const hasContent = formData.description || formData.links.length > 0 || formData.categories.length > 0;
    
    if (!hasContent) {
      // Simple name display with chevron
      return (
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm">
          <span 
            onClick={handleStartNameEdit}
            className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-100"
            title="Click to edit workflow name (or press F2)"
          >
            {name || 'Untitled Workflow'}
          </span>
          <button
            onClick={handleExpandForm}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Expand form"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      );
    }

    // Rich card display with content
    return (
      <div className="absolute top-4 left-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-80">
        <div className="flex items-center justify-between mb-2">
          <h3 
            onClick={handleStartNameEdit}
            className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            title="Click to edit workflow name"
          >
            {name || 'Untitled Workflow'}
          </h3>
          <button
            onClick={handleExpandForm}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
            title="Edit details"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        
        {formData.description && (
          <div className="mb-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {formData.description}
            </p>
          </div>
        )}
        
        {formData.links.length > 0 && (
          <div className="mb-2">
            {formData.linksFormat === 'bulleted' ? (
              <ul className="text-xs space-y-1">
                {formData.links.map((link) => (
                  <li key={link.id} className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-gray-400 rounded-full flex-shrink-0"></span>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {link.text}
                      <ExternalLink size={10} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs space-y-1">
                {formData.links.map((link) => (
                  <div key={link.id}>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {link.text}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {formData.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {formData.categories.map((category) => (
              <span 
                key={category}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
              >
                {category}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Name editing mode
  if (mode === 'editing-name') {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleNameKeyDown}
        onBlur={handleFinishNameEdit}
        className="absolute top-4 left-4 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{
          minWidth: '200px',
          maxWidth: '400px',
        }}
        placeholder="Workflow name..."
      />
    );
  }

  // Expanded form mode
  return (
    <div 
      ref={formRef}
      className="absolute top-4 left-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 w-96"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Workflow Details</h3>
        <button
          onClick={handleSaveForm}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Name Field */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="Workflow name..."
        />
      </div>

      {/* Description Field */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
          placeholder="Describe your workflow..."
          rows={3}
        />
      </div>

      {/* References & Links */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">References & Links</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFormData(prev => ({ ...prev, linksFormat: 'text' }))}
              className={`p-1 rounded transition-colors ${formData.linksFormat === 'text' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Text format"
            >
              <Type size={12} />
            </button>
            <button
              onClick={() => setFormData(prev => ({ ...prev, linksFormat: 'bulleted' }))}
              className={`p-1 rounded transition-colors ${formData.linksFormat === 'bulleted' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Bulleted list"
            >
              <List size={12} />
            </button>
          </div>
        </div>
        
        {/* Add Link Form */}
        <div className="space-y-2 mb-2">
          <input
            type="text"
            value={newLink.text}
            onChange={(e) => setNewLink(prev => ({ ...prev, text: e.target.value }))}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="Link text..."
          />
          <div className="flex gap-2">
            <input
              type="url"
              value={newLink.url}
              onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="https://..."
            />
            <button
              onClick={handleAddLink}
              disabled={!newLink.text.trim() || !newLink.url.trim()}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        {/* Links List */}
        {formData.links.length > 0 && (
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {formData.links.map((link) => (
              <div key={link.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                <a 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                >
                  {link.text}
                  <ExternalLink size={10} />
                </a>
                <button
                  onClick={() => handleRemoveLink(link.id)}
                  className="text-gray-400 hover:text-red-500 ml-2"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
        <input
          ref={categoryRef}
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={handleCategoryKeyDown}
          disabled={formData.categories.length >= 5}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          placeholder={formData.categories.length >= 5 ? "Maximum 5 categories" : "Type and press Enter..."}
        />
        <p className="text-xs text-gray-500 mt-1">Add multiple categories by using Enter to add another</p>
        
        {/* Category Chips */}
        {formData.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {formData.categories.map((category, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded cursor-pointer"
                onClick={() => handleEditCategory(index, category)}
              >
                {editingCategory === category ? (
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      categories: prev.categories.map((cat, i) => i === index ? e.target.value : cat)
                    }))}
                    onBlur={() => setEditingCategory(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingCategory(null);
                      }
                    }}
                    className="bg-transparent border-none outline-none text-xs w-20"
                    autoFocus
                  />
                ) : (
                  category
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCategory(index);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:text-red-500"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Done Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveForm}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Done
        </button>
      </div>
    </div>
  );
};

// Utility to calculate dynamic node height based on content
const calculateNodeHeight = (node: Node, nodeWidth: number): number => {
  const minHeight = 100;
  const maxHeight = 400;
  const titlePadding = 16; // Title padding (8px top + 8px bottom)
  const bodyPadding = 24; // Body padding (12px top + 12px bottom)
  const borderHeight = 2; // Border thickness
  
  // For image nodes with images, defer to explicit sizing
  if (node.type === 'image' && node.data?.src) {
    return minHeight; // Will be overridden by explicit height anyway
  }
  
  // Get text content
  const titleText = node.data?.label || node.type || node.id;
  const bodyText = node.data?.description || '';
  
  // If no meaningful body content, stick to minimum
  if (!bodyText || bodyText.trim() === '' || bodyText.trim() === 'Drop content here…') {
    return minHeight;
  }
  
  // More accurate character width estimation for 12px font
  const avgCharWidth = 7.2;
  const titleLineHeight = 15.6; // 12px * 1.3 line-height
  const bodyLineHeight = 16.8; // 12px * 1.4 line-height
  
  // Calculate available width for text (subtract padding)
  const titleAvailableWidth = nodeWidth - 24; // Title has same padding as body
  const bodyAvailableWidth = nodeWidth - 24;
  
  const titleCharsPerLine = Math.max(10, Math.floor(titleAvailableWidth / avgCharWidth));
  const bodyCharsPerLine = Math.max(10, Math.floor(bodyAvailableWidth / avgCharWidth));
  
  // Calculate lines needed for title
  const titleLines = Math.max(1, Math.ceil(titleText.length / titleCharsPerLine));
  
  // Calculate lines needed for body text (handle newlines and wrapping)
  let bodyLines = 0;
  const textLines = bodyText.split('\n');
  for (const line of textLines) {
    if (line.trim() === '') {
      bodyLines += 1; // Empty line
    } else {
      bodyLines += Math.max(1, Math.ceil(line.length / bodyCharsPerLine));
    }
  }
  
  // Calculate total height
  const titleHeight = (titleLines * titleLineHeight) + titlePadding;
  const bodyHeight = Math.max(40, (bodyLines * bodyLineHeight) + bodyPadding); // Minimum 40px for body
  const calculatedHeight = titleHeight + bodyHeight + borderHeight;
  
  // Apply constraints and round up
  return Math.min(maxHeight, Math.max(minHeight, Math.ceil(calculatedHeight)));
};

type Props = {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  onNodesChange: (n: Node[]) => void;
  onEdgesChange: (e: Edge[]) => void;
  onCanvasObjectsChange?: (canvasObjects: CanvasObject[]) => void;
  onConnect?: (c: { source: string; target: string }) => void;
  gridType?: 'dots'|'lines'|'none';
  minZoom?: number;
  maxZoom?: number;
  fitView?: boolean;
  showMiniMap?: boolean;
  // Plugin system integration
  core?: KiteFrameCore;
  enablePlugins?: boolean;
  selectedNodes?: string[];
  onNodeClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasClick?: () => void;
  onNodeDoubleClick?: (e: React.MouseEvent, node: Node) => void;
  onNodeRightClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasObjectClick?: (e: React.MouseEvent, canvasObject: CanvasObject) => void;
  onCanvasObjectDoubleClick?: (e: React.MouseEvent, canvasObject: CanvasObject) => void;
  onCanvasObjectRightClick?: (e: React.MouseEvent, canvasObject: CanvasObject) => void;
  onEdgeClick?: (e: React.MouseEvent, edge: Edge) => void;
  onNodeResize?: (id: string, w: number, h: number) => void;
  onImageButtonClick?: (nodeId: string) => void;
  onEdgeReconnect?: (edgeId: string, newSource: string, newTarget: string) => void;
  smartConnect?: boolean;
  snapToGuides?: boolean;
  snapToGrid?: boolean;
  className?: string;
  onImageUpload?: (id:string, data:string)=>void;
  onImageUrlSet?: (id:string, url:string)=>void;
  disablePan?: boolean;
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  
  // Pro Features
  proFeatures?: ProFeaturesConfig;
  onQuickAdd?: (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left') => void;
  
  // Animation configuration for connection previews
  connectionAnimationConfig?: Partial<AnimationConfig>;
  
  // Workflow name and metadata
  workflowName?: string;
  onWorkflowNameChange?: (name: string) => void;
  workflowMetadata?: WorkflowMetadata;
  onWorkflowMetadataChange?: (metadata: WorkflowMetadata) => void;
  
  // User identification for reactions and interactions
  currentUserId?: string;
};

type Viewport = { x: number; y: number; zoom: number };

type ConnectingState = {
  sourceId: string;
  wx: number; // world x following cursor
  wy: number; // world y following cursor
  hoverTargetId: string | null; // node under cursor (if any)
  eligible: boolean; // can connect source -> hoverTargetId?
};

export const KiteFrameCanvas: React.FC<Props> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalViewport, setInternalViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  
  // Use external viewport if provided, otherwise use internal
  const viewport = props.viewport || internalViewport;
  const setViewport = props.onViewportChange || setInternalViewport;
  
  // Plugin system integration
  const core = props.core || kiteFrameCore;
  const enablePlugins = props.enablePlugins !== false; // Default to true
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{x:number;y:number}|null>(null);
  const [selectRect, setSelectRect] = useState<null | {x:number;y:number;w:number;h:number}>(null);
  const selectStart = useRef<{x:number;y:number}|null>(null);
  const justCompletedSelection = useRef<boolean>(false);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  
  // Smart Guides state
  const [currentGuides, setCurrentGuides] = useState<SnapGuide[]>([]);

  // Pro Features Configuration
  const quickAddConfig = props.proFeatures?.quickAdd;
  const isQuickAddEnabled = quickAddConfig?.enabled !== false; // Default enabled
  const [quickAddButtons, setQuickAddButtons] = useState<Map<string, HTMLElement>>(new Map());
  const [ghostPreview, setGhostPreview] = useState<HTMLElement | null>(null);

  const minZoom = props.minZoom ?? 0.1;
  const maxZoom = props.maxZoom ?? 3;

  // Pro Features: Quick Add Functions
  const createQuickAddNode = (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left'): Node => {
    const spacing = quickAddConfig?.defaultSpacing ?? 250;
    const nodeType = quickAddConfig?.defaultNodeType ?? 'process';
    const template = quickAddConfig?.defaultNodeTemplate ?? {};
    
    let newPosition = { x: 0, y: 0 };
    switch (position) {
      case 'top':
        newPosition = { x: sourceNode.position.x, y: sourceNode.position.y - spacing };
        break;
      case 'right':
        newPosition = { x: sourceNode.position.x + spacing, y: sourceNode.position.y };
        break;
      case 'bottom':
        newPosition = { x: sourceNode.position.x, y: sourceNode.position.y + spacing };
        break;
      case 'left':
        newPosition = { x: sourceNode.position.x - spacing, y: sourceNode.position.y };
        break;
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: newPosition,
      data: {
        label: 'New Process',
        description: 'Configure process settings',
        icon: 'Cog',
        iconColor: 'text-gray-500',
        ...template
      },
      width: 200,
      height: 100
    };

    return newNode;
  };

  const handleQuickAdd = (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left') => {
    const newNode = createQuickAddNode(sourceNode, position);
    
    // Add the new node
    const updatedNodes = [...props.nodes, newNode];
    props.onNodesChange(updatedNodes);

    // Create connecting edge if handler exists
    if (props.onConnect) {
      props.onConnect({ source: sourceNode.id, target: newNode.id });
    }

    // Call custom handler if provided
    if (quickAddConfig?.onQuickAdd) {
      quickAddConfig.onQuickAdd(sourceNode, position, newNode);
    }
  };

  // ---------- helpers ----------
  const getNodeRect = (n: Node) => {
    const w = n.style?.width ?? n.width ?? 200;
    // Use same logic as in rendering for consistency
    const dynamicHeight = calculateNodeHeight(n, w);
    const explicitHeight = n.style?.height ?? (n.type === 'image' && n.data?.src ? n.height : undefined);
    const h = explicitHeight ?? Math.max(dynamicHeight, n.height ?? 100);
    return {
      x: n.position.x,
      y: n.position.y,
      w, h,
      cx: n.position.x + w/2,
      cy: n.position.y + h/2,
    };
  };

  const pointInNode = (x: number, y: number, n: Node) => {
    const r = getNodeRect(n);
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };

  const findDroppableTarget = (wx: number, wy: number) => {
    // prioritize topmost nodes (later in array can be on top if you layer)
    for (let i = props.nodes.length - 1; i >= 0; i--) {
      const n = props.nodes[i];
      if (n.hidden) continue;
      if (pointInNode(wx, wy, n)) return n;
    }
    return null;
  };

  const edgeExists = (sourceId: string, targetId: string) =>
    props.edges.some(e => e.source === sourceId && e.target === targetId);

  // choose an exit anchor on source node towards (tx, ty)
  const sourceAnchorTowards = (src: Node, tx: number, ty: number) => {
    const r = getNodeRect(src);
    const dx = tx - r.cx;
    const dy = ty - r.cy;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx >= absDy) {
      // horizontal exit
      return dx >= 0 ? { x: r.x + r.w, y: r.cy } : { x: r.x, y: r.cy };
    } else {
      // vertical exit
      return dy >= 0 ? { x: r.cx, y: r.y + r.h } : { x: r.cx, y: r.y };
    }
  };

  // Wheel/pinch zoom (cursor-anchored)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const old = viewport;
    const newZoom = zoomAroundPoint(old.zoom, e.deltaY * 0.00225, minZoom, maxZoom);
    const mouseWorld = clientToWorld(e.clientX, e.clientY, old, rect);
    const newX = e.clientX - rect.left - mouseWorld.x * newZoom;
    const newY = e.clientY - rect.top - mouseWorld.y * newZoom;
    setViewport({ x: newX, y: newY, zoom: newZoom });
  };

  // Background interactions: pan or selection (Shift+drag)
  const onBackgroundDown = (e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    if (isShift) {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current!.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;
      selectStart.current = { x: containerX, y: containerY };
      setSelectRect({ x: containerX, y: containerY, w: 0, h: 0 });
    } else if (!props.disablePan) {
      setPanning(true);
      panStart.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    }
  };

  const onBackgroundMove = (e: React.MouseEvent) => {
    if (panning && panStart.current) {
      const panStartRef = panStart.current; // Capture reference to avoid race condition
      setViewport({ ...viewport, x: e.clientX - panStartRef.x, y: e.clientY - panStartRef.y });
      return;
    }
    if (selectStart.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;
      const sx = selectStart.current.x, sy = selectStart.current.y;
      setSelectRect({ 
        x: Math.min(sx, containerX), 
        y: Math.min(sy, containerY), 
        w: Math.abs(containerX - sx), 
        h: Math.abs(containerY - sy) 
      });
      return;
    }
    if (connecting) {
      const rect = containerRef.current!.getBoundingClientRect();
      const wpos = clientToWorld(e.clientX, e.clientY, viewport, rect);
      // find droppable node under cursor (body, not only handle)
      const target = findDroppableTarget(wpos.x, wpos.y);
      let hoverTargetId: string | null = null;
      let eligible = false;
      if (target) {
        hoverTargetId = target.id;
        // rules: cannot connect to self; cannot create duplicate edge
        eligible = (target.id !== connecting.sourceId) && !edgeExists(connecting.sourceId, target.id);
      }
      setConnecting(c => c ? { ...c, wx: wpos.x, wy: wpos.y, hoverTargetId, eligible } : null);
      return;
    }
  };

  const onBackgroundUp = (e: React.MouseEvent) => {
    if (panning) {
      setPanning(false); 
      panStart.current = null;
    }
    
    if (selectStart.current) {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current!.getBoundingClientRect();
      const r = selectRect!;
      const x1 = (r.x - viewport.x) / viewport.zoom;
      const y1 = (r.y - viewport.y) / viewport.zoom;
      const x2 = ((r.x + r.w) - viewport.x) / viewport.zoom;
      const y2 = ((r.y + r.h) - viewport.y) / viewport.zoom;
      const nx1 = Math.min(x1,x2), ny1=Math.min(y1,y2), nx2=Math.max(x1,x2), ny2=Math.max(y1,y2);
      
      const updated = props.nodes.map(n => {
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const nodeBounds = {
          x1: n.position.x,
          y1: n.position.y,
          x2: n.position.x + w,
          y2: n.position.y + h
        };
        
        // Use overlap detection instead of complete containment
        const overlapsX = nodeBounds.x1 < nx2 && nodeBounds.x2 > nx1;
        const overlapsY = nodeBounds.y1 < ny2 && nodeBounds.y2 > ny1;
        const selected = overlapsX && overlapsY;
        
        return { ...n, selected };
      });
      props.onNodesChange(updated);
      setSelectRect(null); 
      selectStart.current = null;
      justCompletedSelection.current = true;
      // Reset flag after a brief delay to allow click event to be skipped
      setTimeout(() => { justCompletedSelection.current = false; }, 100);
      return; // Don't trigger onClick
    }
    if (connecting) {
      const { sourceId, hoverTargetId, eligible } = connecting;

      // If hovering a valid node, connect directly (no need to land on handle)
      if (hoverTargetId && eligible) {
        props.onConnect?.({ source: sourceId, target: hoverTargetId });
        setConnecting(null);
        return;
      }

      // fallback: nearest-handle threshold logic (optional)
      const rect = containerRef.current!.getBoundingClientRect();
      const world = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const threshold = 16;
      let best: { id:string; dist:number } | null = null;
      for (const n of props.nodes) {
        if (n.id === sourceId) continue;
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const handles = [
          { x: n.position.x + w/2, y: n.position.y },
          { x: n.position.x + w/2, y: n.position.y + h },
          { x: n.position.x,       y: n.position.y + h/2 },
          { x: n.position.x + w,   y: n.position.y + h/2 },
        ];
        for (const pt of handles) {
          const d = Math.hypot(pt.x - world.x, pt.y - world.y);
          if (d < threshold && (!best || d < best.dist)) best = { id: n.id, dist: d };
        }
      }
      if (best && !edgeExists(sourceId, best.id)) {
        props.onConnect?.({ source: sourceId, target: best.id });
      }
      setConnecting(null);
    }
  };

  // Node dragging with group support
  const dragInfo = useRef<{ 
    id: string; 
    start: {x:number;y:number}; 
    origin: {x:number;y:number}; 
    origins?: {id: string; origin: {x:number;y:number}}[];
    isGroupDrag?: boolean;
  }|null>(null);

  // Canvas object dragging
  const canvasObjectDragInfo = useRef<{ 
    id: string; 
    start: {x:number;y:number}; 
    origin: {x:number;y:number}; 
  }|null>(null);
  
  // Simple drag tracking without interference
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Handle node dragging
      if (dragInfo.current) {
        handleNodeDragMove(e);
        return;
      }
      
      // Handle canvas object dragging
      if (canvasObjectDragInfo.current) {
        handleCanvasObjectDragMove(e);
        return;
      }
    };
    
    const handleNodeDragMove = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      
      const rect = containerRef.current!.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const dx = wp.x - dragInfo.current.start.x;
      const dy = wp.y - dragInfo.current.start.y;
      
      console.log('🔧 DRAG MOVE:', {
        dragInfo: dragInfo.current,
        worldPos: wp,
        delta: { dx, dy },
        viewport,
        isGroupDrag: dragInfo.current.isGroupDrag
      });
      
      if (dragInfo.current.isGroupDrag && dragInfo.current.origins) {
        // Group drag: move all selected nodes
        const updated = props.nodes.map(n => {
          const nodeOrigin = dragInfo.current!.origins!.find(o => o.id === n.id);
          if (nodeOrigin) {
            return { ...n, position: { x: nodeOrigin.origin.x + dx, y: nodeOrigin.origin.y + dy } };
          }
          return n;
        });
        console.log('🔧 GROUP DRAG UPDATE:', {
          updatedNodes: updated.filter(n => dragInfo.current!.origins!.some(o => o.id === n.id)),
          totalNodes: updated.length
        });
        props.onNodesChange(updated);
        

      } else {
        // Individual drag: move single node with smart guides
        const id = dragInfo.current.id;
        const targetPosition = { x: dragInfo.current!.origin.x + dx, y: dragInfo.current!.origin.y + dy };
        
        // Apply smart guides if enabled
        let finalPosition = targetPosition;
        let currentGuides: SnapGuide[] = [];
        
        if (props.proFeatures && props.proFeatures.smartGuides?.enabled !== false) {
          console.log('🎯 Smart Guides: Enabled, processing snap...');
          
          const draggedNode = props.nodes.find(n => n.id === id);
          if (draggedNode) {
            const smartGuidesConfig = props.proFeatures.smartGuides || {};
            const snapSettings = {
              enabled: smartGuidesConfig.enabled !== false,
              threshold: smartGuidesConfig.threshold || defaultSnapSettings.threshold,
              showGuides: smartGuidesConfig.showGuides !== false,
              snapToNodes: smartGuidesConfig.snapToNodes !== false,
              snapToGrid: smartGuidesConfig.snapToGrid === true,
              gridSize: smartGuidesConfig.gridSize || defaultSnapSettings.gridSize,
              snapToCanvas: smartGuidesConfig.snapToCanvas !== false
            };
            
            const canvasSize = { width: 2000, height: 1500 };
            const snapResult = calculateSnapPosition(
              draggedNode,
              targetPosition,
              props.nodes,
              canvasSize,
              snapSettings
            );
            
            finalPosition = snapResult.position;
            setCurrentGuides(snapResult.guides);
            
            console.log('🎯 Smart Guides Applied:', {
              targetPosition,
              finalPosition,
              guides: snapResult.guides,
              snapped: snapResult.snapped
            });
          }
        }
        
        const updated = props.nodes.map(n => n.id === id ? { ...n, position: finalPosition } : n);
        console.log('🔧 INDIVIDUAL DRAG UPDATE:', {
          nodeId: id,
          targetPosition,
          finalPosition,
          snapApplied: finalPosition.x !== targetPosition.x || finalPosition.y !== targetPosition.y,
          updated: updated.find(n => n.id === id)
        });
        props.onNodesChange(updated);
        

      }
    };
    
    const handleCanvasObjectDragMove = (e: MouseEvent) => {
      if (!canvasObjectDragInfo.current) return;
      
      const rect = containerRef.current!.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const dx = wp.x - canvasObjectDragInfo.current.start.x;
      const dy = wp.y - canvasObjectDragInfo.current.start.y;
      
      const newPosition = {
        x: canvasObjectDragInfo.current.origin.x + dx,
        y: canvasObjectDragInfo.current.origin.y + dy
      };
      
      // Apply smart guides if enabled
      let finalPosition = newPosition;
      let currentGuides: SnapGuide[] = [];
      
      if (props.snapToGuides !== false && props.proFeatures?.smartGuides?.enabled !== false) {
        const allOtherObjects = [
          ...props.nodes.map(n => ({ ...getNodeRect(n), id: n.id })),
          ...(props.canvasObjects || []).filter(obj => obj.id !== canvasObjectDragInfo.current!.id).map(obj => ({
            x: obj.position.x,
            y: obj.position.y,
            w: obj.style?.width || obj.width || 200,
            h: obj.style?.height || obj.height || 150,
            id: obj.id
          }))
        ];
        
        const draggedObjectSize = {
          w: (props.canvasObjects || []).find(obj => obj.id === canvasObjectDragInfo.current!.id)?.style?.width ||
             (props.canvasObjects || []).find(obj => obj.id === canvasObjectDragInfo.current!.id)?.width || 200,
          h: (props.canvasObjects || []).find(obj => obj.id === canvasObjectDragInfo.current!.id)?.style?.height ||
             (props.canvasObjects || []).find(obj => obj.id === canvasObjectDragInfo.current!.id)?.height || 150
        };
        
        // Create a temporary node-like object for the dragged canvas object
        const draggedObjectAsNode = {
          id: canvasObjectDragInfo.current!.id,
          position: newPosition,
          width: draggedObjectSize.w,
          height: draggedObjectSize.h
        } as Node;
        
        const snapResult = calculateSnapPosition(
          draggedObjectAsNode,
          newPosition,
          props.nodes,
          { width: 2000, height: 2000 }, // Canvas size
          defaultSnapSettings
        );
        
        finalPosition = snapResult.position;
        currentGuides = snapResult.guides;
        setCurrentGuides(currentGuides);
      }
      
      // Update canvas object position
      const updatedObjects = (props.canvasObjects || []).map(obj => 
        obj.id === canvasObjectDragInfo.current!.id 
          ? { ...obj, position: finalPosition }
          : obj
      );
      props.onCanvasObjectsChange?.(updatedObjects);
    };
    
    const onUp = () => { 
      if (dragInfo.current) {
        console.log('🔧 DRAG END:', dragInfo.current);
        
        // Handle smart connect auto-connection on drag end  
        if (!dragInfo.current.isGroupDrag && props.proFeatures?.smartConnect?.enabled !== false) {
          const draggedNode = props.nodes.find(n => n.id === dragInfo.current?.id);
          if (draggedNode) {
            console.log('🔗 Smart Connect: Checking auto-connection for', dragInfo.current.id);
            // The SmartConnectPlugin handles auto-connection logic automatically through drag events
            // No additional code needed here as the plugin is already integrated
          }
        }
        
        dragInfo.current = null;
      }
      
      if (canvasObjectDragInfo.current) {
        console.log('🔧 CANVAS OBJECT DRAG END:', canvasObjectDragInfo.current);
        canvasObjectDragInfo.current = null;
      }
      
      // Clear guides when drag ends
      setCurrentGuides([]);
    };
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [viewport, props]);

  // Grid (optional – keep your existing grid if you have one)
  const Grid = () => {
    if (props.gridType === 'none') return null;
    return (
      <svg className="kiteframe-grid">
        {props.gridType === 'lines' && (
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
          </pattern>
        )}
        <rect width="100%" height="100%" fill={props.gridType==='lines' ? 'url(#grid)' : 'none'} />
      </svg>
    );
  };

  const worldStyle = { transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` };

  return (
    <div
      ref={containerRef}
      className={`kiteframe-canvas ${props.className||''} ${panning ? 'kiteframe-hand': ''}`}
      onWheel={onWheel}
      onMouseDown={onBackgroundDown}
      onMouseMove={onBackgroundMove}
      onMouseUp={onBackgroundUp}
      onClick={(e) => {
        // Don't trigger canvas click if we just finished a selection
        if (selectStart.current || selectRect || justCompletedSelection.current) {
          return;
        }
        
        // Deselect all canvas objects when clicking background
        if (props.canvasObjects && props.canvasObjects.some(obj => obj.selected)) {
          const updatedObjects = props.canvasObjects.map(obj => ({ ...obj, selected: false }));
          props.onCanvasObjectsChange?.(updatedObjects);
        }
        
        props.onCanvasClick?.();
      }}
    >
      <Grid />
      <div className="kiteframe-world" style={worldStyle}>
        {/* Existing edges */}
        <svg className="kiteframe-edge-layer" style={{ 
          position: 'absolute',
          left: '-5000px',
          top: '-5000px',
          width: '10000px', 
          height: '10000px',
          pointerEvents: 'none',
          overflow: 'visible'
        }}
        viewBox="-5000 -5000 10000 10000"
        preserveAspectRatio="none">
          {props.edges.map(e => {
            const s = props.nodes.find(n => n.id === e.source);
            const t = props.nodes.find(n => n.id === e.target);
            if (!s || !t) return null;
            return <ConnectionEdge key={e.id} edge={e} sourceNode={s} targetNode={t} onEdgeClick={(edge) => props.onEdgeClick?.(e as any, edge)} />;
          })}

          {/* Edge reconnection handles for selected edges */}
          {props.edges.map(e => {
            // Check if edge reconnection is enabled
            const edgeReconnectionConfig = props.proFeatures?.edgeReconnection;
            const isReconnectionEnabled = edgeReconnectionConfig?.enabled !== false; // Default enabled
            const isEdgeReconnectable = e.reconnectable || edgeReconnectionConfig?.enableAllEdges;
            
            // Only show handles if edge is selected and reconnection is enabled
            if (!e.selected || !isReconnectionEnabled || !isEdgeReconnectable) return null;
            
            const s = props.nodes.find(n => n.id === e.source);
            const t = props.nodes.find(n => n.id === e.target);
            if (!s || !t) return null;
            
            return (
              <EdgeHandles 
                key={`${e.id}-handles`}
                edge={e}
                sourceNode={s}
                targetNode={t}
                nodes={props.nodes}
                edges={props.edges}
                onEdgeReconnect={props.onEdgeReconnect}
                viewport={viewport}
                visualConfig={edgeReconnectionConfig?.visualFeedback}
              />
            );
          })}

          {/* ANIMATED PREVIEW EDGE while dragging a connection */}
          {connecting && (() => {
            const src = props.nodes.find(n => n.id === connecting.sourceId);
            if (!src) return null;

            // Where to draw to: hovered node center (if exists) else cursor world position
            let tx = connecting.wx, ty = connecting.wy;
            if (connecting.hoverTargetId) {
              const tgt = props.nodes.find(n => n.id === connecting.hoverTargetId);
              if (tgt) {
                const r = getNodeRect(tgt);
                tx = r.cx; ty = r.cy;
              }
            }

            // Source anchor smart-positioned
            const anchor = sourceAnchorTowards(src, tx, ty);
            const sx = anchor.x, sy = anchor.y;

            // Use animated connection preview
            return (
              <AnimatedConnectionPreview
                key="animated-preview"
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                isConnecting={true}
                isValidTarget={connecting.hoverTargetId !== null && connecting.eligible}
                isInvalidTarget={connecting.hoverTargetId !== null && !connecting.eligible}
                config={{
                  duration: 600,
                  easing: 'ease-out',
                  pulseOnConnection: true,
                  showParticles: true,
                  glowOnHover: true,
                  ...props.connectionAnimationConfig
                }}
              />
            );
          })()}
        </svg>

        {/* Nodes */}
        {props.nodes.filter(n=>!n.hidden).map(n => {
          const w = n.style?.width ?? n.width ?? 200;
          // Use dynamic height calculation, but respect explicit style height or image node heights
          const dynamicHeight = calculateNodeHeight(n, w);
          const explicitHeight = n.style?.height ?? (n.type === 'image' && n.data?.src ? n.height : undefined);
          const h = explicitHeight ?? Math.max(dynamicHeight, n.height ?? 100);
          // Enhanced color system with separate header/body colors
          const colors = n.data?.colors || {};
          const headerBg = colors.headerBackground || n.data?.color || '#f8fafc';
          const bodyBg = colors.bodyBackground || n.data?.color || 'white';
          const border = colors.borderColor || n.data?.borderColor || '#e2e8f0';
          const headerText = colors.headerTextColor || colors.textColor || n.data?.textColor || '#0f172a';
          const bodyText = colors.bodyTextColor || colors.textColor || n.data?.textColor || '#475569';
          
          // Helper function to add reactions to nodes
          const addReaction = (nodeId: string, emoji: string) => {
            const updatedNodes = props.nodes.map(node => {
              if (node.id === nodeId) {
                const reactions = node.data?.reactions || {};
                const reaction = reactions[emoji] || { count: 0, userIds: [] };
                return {
                  ...node,
                  data: {
                    ...node.data,
                    reactions: {
                      ...reactions,
                      [emoji]: {
                        count: reaction.count + 1,
                        userIds: [...reaction.userIds, props.currentUserId || 'current-user']
                      }
                    }
                  }
                };
              }
              return node;
            });
            props.onNodesChange?.(updatedNodes);
          };

          const removeReaction = (nodeId: string, emoji: string) => {
            const updatedNodes = props.nodes.map(node => {
              if (node.id === nodeId) {
                const reactions = node.data?.reactions || {};
                const reaction = reactions[emoji];
                if (reaction) {
                  const newUserIds = reaction.userIds.filter((id: string) => id !== (props.currentUserId || 'current-user'));
                  const newCount = Math.max(0, reaction.count - 1);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      reactions: {
                        ...reactions,
                        [emoji]: {
                          count: newCount,
                          userIds: newUserIds
                        }
                      }
                    }
                  };
                }
              }
              return node;
            });
            props.onNodesChange?.(updatedNodes);
          };

          // Render new node types using their specialized components
          if (n.type === 'text') {
            return <TextNode 
              key={n.id} 
              node={n} 
              onUpdate={(updates) => {
                const updated = props.nodes.map(node => node.id === n.id ? { ...node, data: { ...node.data, ...updates } } : node);
                props.onNodesChange?.(updated);
              }} 
              onResize={(width, height) => {
                const updated = props.nodes.map(node => node.id === n.id ? { ...node, style: { ...node.style, width, height } } : node);
                props.onNodesChange?.(updated);
              }}
              onAddReaction={addReaction}
              onRemoveReaction={removeReaction}
            />;
          }

          if (n.type === 'sticky') {
            return <StickyNote 
              key={n.id} 
              node={n} 
              onUpdate={(updates) => {
                const updated = props.nodes.map(node => node.id === n.id ? { ...node, data: { ...node.data, ...updates } } : node);
                props.onNodesChange?.(updated);
              }} 
              onResize={(width, height) => {
                const updated = props.nodes.map(node => node.id === n.id ? { ...node, style: { ...node.style, width, height } } : node);
                props.onNodesChange?.(updated);
              }} 
              onDelete={() => {
                const updated = props.nodes.filter(node => node.id !== n.id);
                props.onNodesChange?.(updated);
              }}
              onAddReaction={addReaction}
              onRemoveReaction={removeReaction}
            />;
          }

          if (n.type === 'shape') {
            return <ShapeNode 
              key={n.id} 
              node={n} 
              onUpdate={(updates) => {
                const updated = props.nodes.map(node => node.id === n.id ? { ...node, data: { ...node.data, ...updates } } : node);
                props.onNodesChange?.(updated);
              }} 
              onResize={(width, height) => {
                const updated = props.nodes.map(node => node.id === n.id ? { ...node, style: { ...node.style, width, height } } : node);
                props.onNodesChange?.(updated);
              }}
              onAddReaction={addReaction}
              onRemoveReaction={removeReaction}
            />;
          }

          return (
            <div
              key={n.id}
              data-node-id={n.id}
              className={`kiteframe-node group ${n.selected?'selected':''}`}
              style={{ 
                left: n.position.x, 
                top: n.position.y, 
                width: w, 
                height: h, 
                borderColor: border,
                background: 'transparent', // Remove default background since we'll use separate header/body
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseDown={(e)=>{
                e.stopPropagation();
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
                
                // Check if this node is selected and if there are other selected nodes
                const selectedNodes = props.nodes.filter(node => node.selected === true);
                const isGroupDrag = selectedNodes.length > 1 && n.selected === true;
                
                // Prepare origins for all nodes that will be dragged
                const origins = isGroupDrag 
                  ? selectedNodes.map(node => ({ id: node.id, origin: { ...node.position } }))
                  : [{ id: n.id, origin: { ...n.position } }];
                
                dragInfo.current = { 
                  id: n.id, 
                  start: wp, 
                  origin: { ...n.position },
                  origins: origins,
                  isGroupDrag: isGroupDrag
                };
                
                console.log('🔧 DRAG START:', {
                  nodeId: n.id,
                  worldPos: wp,
                  nodePosition: n.position,
                  selectedNodes: selectedNodes.map(sn => sn.id),
                  isGroupDrag,
                  dragInfo: dragInfo.current
                });
              }}
              onDoubleClick={(e)=>props.onNodeDoubleClick?.(e, n)}
              onContextMenu={(e)=>{ e.preventDefault(); props.onNodeRightClick?.(e, n); }}
              onClick={(e) => {
                e.stopPropagation();
                console.log(`🎯 NODE CLICK:`, { nodeId: n.id, wasSelected: n.selected });
                props.onNodeClick?.(e, n);
              }}
            >
              {!n.data?.hideHeader && (
                <div 
                  className="title"
                  style={{ 
                    backgroundColor: headerBg,
                    color: headerText,
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    borderBottom: `1px solid ${border}`
                  }}
                >
                  {n.data?.label || n.type || n.id}
                </div>
              )}
              {!n.data?.hideDescription && (
                <div 
                  className="body" 
                  style={{ 
                    backgroundColor: bodyBg,
                    color: bodyText,
                    borderBottomLeftRadius: n.data?.hideHeader ? '8px' : undefined,
                    borderBottomRightRadius: n.data?.hideHeader ? '8px' : undefined,
                    borderTopLeftRadius: n.data?.hideHeader ? '8px' : undefined,
                    borderTopRightRadius: n.data?.hideHeader ? '8px' : undefined,
                    padding: n.type === 'image' ? '0' : undefined,
                    flex: 1, // Make the body fill remaining space
                    display: 'flex',
                    flexDirection: 'column',
                    height: n.type === 'image' ? `${n.data?.hideHeader ? h : h - 30}px` : undefined, // Account for title height
                    alignItems: n.type === 'image' ? 'center' : undefined,
                    justifyContent: n.type === 'image' ? 'center' : undefined
                  }}
                >
                  {n.type === 'image' ? (
                  n.data?.src ? 
                    <img 
                      src={n.data.src} 
                      alt="" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        width: n.data?.imageSize === 'fill' ? '100%' : 'auto',
                        height: n.data?.imageSize === 'fill' ? '100%' : 'auto',
                        objectFit: n.data?.imageSize === 'fill' ? 'cover' : 
                                   n.data?.imageSize === 'fit' ? 'scale-down' : 
                                   'contain',
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        draggable: false
                      } as React.CSSProperties} 
                    /> : 
                    <div style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      color: '#666',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      gap: '8px'
                    }}>
                      {n.data?.displayText ? (
                        <div style={{
                          fontSize: '11px',
                          color: n.data?.isImageBroken ? '#dc2626' : '#888',
                          fontStyle: 'italic',
                          marginBottom: '8px',
                          whiteSpace: 'pre-line',
                          textAlign: 'center'
                        }}>
                          {n.data?.isImageBroken && '⚠️ '}
                          {n.data.displayText}
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onImageButtonClick?.(n.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          border: '1px dashed #ccc',
                          borderRadius: '4px',
                          background: 'transparent',
                          color: '#666',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#007bff';
                          e.currentTarget.style.color = '#007bff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = '#ccc';
                          e.currentTarget.style.color = '#666';
                        }}
                      >
                        📷 Add Image
                      </button>
                    </div>
                ) : (
                  n.data?.description || 'Drop content here…'
                )}
                </div>
              )}
              {n.showHandles !== false && <NodeHandles 
                node={n} 
                scale={viewport.zoom}
                onHandleConnect={(p, e)=>{
                  if (!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
                  setConnecting({ sourceId: n.id, wx: wp.x, wy: wp.y, hoverTargetId: null, eligible: false });
                }}
                proFeatures={props.proFeatures}
                onQuickAdd={props.onQuickAdd}
              />}
              
              {/* Emoji reactions */}
              <div className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1">
                <EmojiReactions 
                  nodeId={n.id}
                  reactions={n.data?.reactions}
                  onAddReaction={(nodeId, emoji) => {
                    const updatedNodes = props.nodes.map(node => {
                      if (node.id === nodeId) {
                        const reactions = node.data?.reactions || {};
                        const reaction = reactions[emoji] || { count: 0, userIds: [] };
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            reactions: {
                              ...reactions,
                              [emoji]: {
                                count: reaction.count + 1,
                                userIds: [...reaction.userIds, props.currentUserId || 'current-user']
                              }
                            }
                          }
                        };
                      }
                      return node;
                    });
                    props.onNodesChange?.(updatedNodes);
                  }}
                  onRemoveReaction={(nodeId, emoji) => {
                    const updatedNodes = props.nodes.map(node => {
                      if (node.id === nodeId) {
                        const reactions = node.data?.reactions || {};
                        const reaction = reactions[emoji];
                        if (reaction) {
                          const newUserIds = reaction.userIds.filter((id: string) => id !== (props.currentUserId || 'current-user'));
                          const newCount = Math.max(0, reaction.count - 1);
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              reactions: {
                                ...reactions,
                                [emoji]: {
                                  count: newCount,
                                  userIds: newUserIds
                                }
                              }
                            }
                          };
                        }
                      }
                      return node;
                    });
                    props.onNodesChange?.(updatedNodes);
                  }}
                  position="bottom"
                />
              </div>
            </div>
          );
        })}

        {/* Canvas Objects */}
        {(props.canvasObjects || []).filter(obj => !obj.hidden).map(obj => {
          // Helper functions for canvas object reactions
          const addCanvasObjectReaction = (objectId: string, emoji: string) => {
            const updatedObjects = (props.canvasObjects || []).map(canvasObject => {
              if (canvasObject.id === objectId) {
                const reactions = canvasObject.reactions || {};
                const reaction = reactions[emoji] || { emoji, count: 0, userIds: [] };
                return {
                  ...canvasObject,
                  reactions: {
                    ...reactions,
                    [emoji]: {
                      emoji,
                      count: reaction.count + 1,
                      userIds: [...reaction.userIds, props.currentUserId || 'current-user']
                    }
                  }
                };
              }
              return canvasObject;
            });
            props.onCanvasObjectsChange?.(updatedObjects);
          };

          const removeCanvasObjectReaction = (objectId: string, emoji: string) => {
            const updatedObjects = (props.canvasObjects || []).map(canvasObject => {
              if (canvasObject.id === objectId) {
                const reactions = canvasObject.reactions || {};
                const reaction = reactions[emoji];
                if (reaction) {
                  const newUserIds = reaction.userIds.filter((id: string) => id !== (props.currentUserId || 'current-user'));
                  const newCount = Math.max(0, reaction.count - 1);
                  return {
                    ...canvasObject,
                    reactions: {
                      ...reactions,
                      [emoji]: {
                        emoji,
                        count: newCount,
                        userIds: newUserIds
                      }
                    }
                  };
                }
              }
              return canvasObject;
            });
            props.onCanvasObjectsChange?.(updatedObjects);
          };

          // Canvas object click handler for selection
          const handleCanvasObjectClick = (objectId: string, e: React.MouseEvent) => {
            e.stopPropagation();
            
            // Select this object and deselect others
            const updatedObjects = (props.canvasObjects || []).map(canvasObject => ({
              ...canvasObject,
              selected: canvasObject.id === objectId
            }));
            props.onCanvasObjectsChange?.(updatedObjects);
            
            // Call the external handler if provided
            const targetObject = (props.canvasObjects || []).find(obj => obj.id === objectId);
            if (targetObject && props.onCanvasObjectClick) {
              props.onCanvasObjectClick(e, targetObject);
            }
          };
          
          // Canvas object drag handler
          const handleCanvasObjectDragStart = (objectId: string, e: React.MouseEvent) => {
            e.stopPropagation();
            if (!containerRef.current) return;
            
            const rect = containerRef.current.getBoundingClientRect();
            const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
            const targetObject = (props.canvasObjects || []).find(obj => obj.id === objectId);
            
            if (targetObject) {
              // Select the object when dragging starts
              const updatedObjects = (props.canvasObjects || []).map(canvasObject => ({
                ...canvasObject,
                selected: canvasObject.id === objectId
              }));
              props.onCanvasObjectsChange?.(updatedObjects);
              
              canvasObjectDragInfo.current = {
                id: objectId,
                start: wp,
                origin: { ...targetObject.position }
              };
              
              console.log('🔧 CANVAS OBJECT DRAG START:', {
                objectId,
                worldPos: wp,
                objectPosition: targetObject.position
              });
            }
          };

          // Render different canvas object types
          if (obj.type === 'text') {
            return <TextObject 
              key={obj.id} 
              object={obj as CanvasObject & { data: import('../types').TextNodeData }} 
              onUpdate={(updates) => {
                const updatedObjects = (props.canvasObjects || []).map(canvasObject => 
                  canvasObject.id === obj.id ? { ...canvasObject, data: { ...canvasObject.data, ...updates } } : canvasObject
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              }} 
              onResize={(width, height) => {
                const updatedObjects = (props.canvasObjects || []).map(canvasObject => 
                  canvasObject.id === obj.id ? { ...canvasObject, style: { ...canvasObject.style, width, height } } : canvasObject
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              }}
              onStartDrag={(e) => handleCanvasObjectDragStart(obj.id, e)}
              onClick={(e) => handleCanvasObjectClick(obj.id, e)}
              onAddReaction={addCanvasObjectReaction}
              onRemoveReaction={removeCanvasObjectReaction}
            />;
          }

          if (obj.type === 'sticky') {
            return <StickyNoteObject 
              key={obj.id} 
              object={obj as CanvasObject & { data: import('../types').StickyNoteData }} 
              onUpdate={(updates) => {
                const updatedObjects = (props.canvasObjects || []).map(canvasObject => 
                  canvasObject.id === obj.id ? { ...canvasObject, data: { ...canvasObject.data, ...updates } } : canvasObject
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              }} 
              onResize={(width, height) => {
                const updatedObjects = (props.canvasObjects || []).map(canvasObject => 
                  canvasObject.id === obj.id ? { ...canvasObject, style: { ...canvasObject.style, width, height } } : canvasObject
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              }}
              onDelete={() => {
                const updatedObjects = (props.canvasObjects || []).filter(canvasObject => canvasObject.id !== obj.id);
                props.onCanvasObjectsChange?.(updatedObjects);
              }}
              onStartDrag={(e) => handleCanvasObjectDragStart(obj.id, e)}
              onClick={(e) => handleCanvasObjectClick(obj.id, e)}
              onAddReaction={addCanvasObjectReaction}
              onRemoveReaction={removeCanvasObjectReaction}
            />;
          }

          if (obj.type === 'shape') {
            return <ShapeObject 
              key={obj.id} 
              object={obj as CanvasObject & { data: import('../types').ShapeNodeData }} 
              onUpdate={(updates) => {
                const updatedObjects = (props.canvasObjects || []).map(canvasObject => 
                  canvasObject.id === obj.id ? { ...canvasObject, data: { ...canvasObject.data, ...updates } } : canvasObject
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              }} 
              onResize={(width, height) => {
                const updatedObjects = (props.canvasObjects || []).map(canvasObject => 
                  canvasObject.id === obj.id ? { ...canvasObject, style: { ...canvasObject.style, width, height } } : canvasObject
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              }}
              onStartDrag={(e) => handleCanvasObjectDragStart(obj.id, e)}
              onClick={(e) => handleCanvasObjectClick(obj.id, e)}
              onAddReaction={addCanvasObjectReaction}
              onRemoveReaction={removeCanvasObjectReaction}
            />;
          }

          return null;
        })}
      </div>
      
      {/* Smart Guides Overlay */}
      <SnapGuides 
        guides={currentGuides}
        canvasSize={{ width: 2000, height: 1500 }}
        viewport={viewport}
        show={currentGuides.length > 0 && props.proFeatures?.smartGuides?.showGuides !== false}
      />

      {/* Selection rectangle - positioned in client coordinates, outside transformed world */}
      {selectRect && (
        <div 
          className="kiteframe-select-rect" 
          style={{ 
            position: 'absolute',
            left: selectRect.x, 
            top: selectRect.y, 
            width: selectRect.w, 
            height: selectRect.h,
            border: '1px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 1000
          }} 
        />
      )}

      {/* Floating workflow name input */}
      {props.workflowName !== undefined && props.onWorkflowNameChange && (
        <WorkflowNameInput 
          name={props.workflowName}
          onChange={props.onWorkflowNameChange}
          metadata={props.workflowMetadata}
          onMetadataChange={props.onWorkflowMetadataChange}
        />
      )}
    </div>
  );
};