import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import "../styles/kiteframe.css";
import "../styles/enhanced-selection.css";
import type {
  Node,
  Edge,
  NodeType,
  CanvasObject,
  CanvasObjectType,
  ProFeaturesConfig,
  QuickAddConfig,
} from "../types";
import { useEventCleanup } from "../utils/eventCleanup";
import { clientToWorld, zoomAroundPoint } from "../utils/geometry";
import {
  recalculateAllEdgeZIndexes,
  sortEdgesByZIndex,
} from "../utils/edgeZIndex";
import { NodeHandles } from "./NodeHandles";
import { ConnectionEdge } from "./ConnectionEdge";
import { SnapGuides } from "./SnapGuides";
import { EdgeHandles } from "./EdgeHandles";
import {
  calculateSnapPosition,
  defaultSnapSettings,
  type SnapGuide,
} from "../utils/snapUtils";
import { ProFeaturesManager } from "../plugins/pro/ProFeaturesManager";
import { KiteFrameCore, kiteFrameCore } from "../core/KiteFrameCore";
import { TextNode } from "./TextNode";
import { StickyNote } from "./StickyNote";
import { ShapeNode } from "./ShapeNode";
import { ImageNode } from "./ImageNode";
import { TableNode } from "./TableNode";
import { FormNode } from "./FormNode";
import { CompoundNode } from "./CompoundNode";
import { WebviewNode } from "./WebviewNode";
import CodeNodeComponent from "./CodeNode";
import RenderNodeComponent, { createRenderNode } from "./RenderNode";
import { generateNodeId } from "../factory/NodeFactory";
import { DataLinkPicker } from "./DataLinkPicker";
import { FlowDetection, Flow, FlowSettings } from "../utils/FlowDetection";
import { WorkflowHeader } from "./WorkflowHeader";
import { StatusBadge } from "./StatusBadge";
import { TextObject } from "./TextObject";
import { StickyNoteObject } from "./StickyNoteObject";
import { ShapeObject } from "./ShapeObject";
import { InlineTextEditor } from "./InlineTextEditor";
import { EmojiReactions } from "./EmojiReactions";
import {
  AnimatedConnectionPreview,
  type AnimationConfig,
} from "./AnimatedConnectionPreview";
import {
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  List,
  Type,
  Pencil,
  Trash2,
  Table2,
} from "lucide-react";
import type { NodeHyperlink, LegacyNodeHyperlink, OgMetadata } from "../types";

const normalizeHyperlinks = (data: any): NodeHyperlink[] => {
  if (data?.hyperlinks && Array.isArray(data.hyperlinks)) {
    return data.hyperlinks.map((h: any, index: number) => ({
      ...h,
      id: h.id || `link-idx-${index}`,
    }));
  }
  if (data?.hyperlink?.url) {
    return [{
      id: 'legacy-0',
      text: data.hyperlink.text || '',
      url: data.hyperlink.url,
      showPreview: data.hyperlink.showPreview,
      metadata: data.hyperlink.metadata,
    }];
  }
  return [];
};

const normalizeUrl = (url: string): string => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
};

interface HyperlinkFooterItemProps {
  hyperlink: NodeHyperlink;
  onEdit?: () => void;
  onDelete?: () => void;
}

const HyperlinkFooterItem: React.FC<HyperlinkFooterItemProps> = ({
  hyperlink,
  onEdit,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setShowMenu(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowMenu(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const normalizedUrl = normalizeUrl(hyperlink.url);
  const hasPreview = hyperlink.showPreview && hyperlink.metadata;
  const previewFailed = hyperlink.showPreview && !hyperlink.metadata;

  return (
    <div 
      className="hyperlink-item"
      style={{ 
        position: 'relative',
        overflow: 'visible',
        zIndex: showMenu ? 101 : 1,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {hasPreview ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'block',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '10px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
          data-testid={`hyperlink-preview-${hyperlink.id}`}
        >
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
            {hyperlink.metadata!.title || hyperlink.text || 'No title'}
          </div>
          {hyperlink.metadata!.description && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: '6px',
            }}>
              {hyperlink.metadata!.description}
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
          }}>
            {hyperlink.metadata!.favicon && (
              <img 
                src={hyperlink.metadata!.favicon} 
                alt="" 
                style={{ width: '14px', height: '14px', borderRadius: '2px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {(() => {
                try {
                  return new URL(hyperlink.url).hostname;
                } catch {
                  return hyperlink.url;
                }
              })()}
            </span>
          </div>
        </a>
      ) : previewFailed ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'block',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '10px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
          data-testid={`hyperlink-preview-fallback-${hyperlink.id}`}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            color: '#3b82f6',
            fontSize: '12px',
          }}>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-all' }}>
              {hyperlink.text || hyperlink.url}
            </span>
          </div>
        </a>
      ) : (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '12px',
            wordBreak: 'break-all',
            padding: '4px 0',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
          data-testid={`hyperlink-text-${hyperlink.id}`}
        >
          <ExternalLink size={14} style={{ flexShrink: 0 }} />
          <span>{hyperlink.text || hyperlink.url}</span>
        </a>
      )}
      
      {showMenu && (onEdit || onDelete) && (
        <div
          ref={menuRef}
          className="hyperlink-hover-menu"
          style={{
            position: 'absolute',
            top: '-32px',
            right: '4px',
            display: 'flex',
            gap: '2px',
            padding: '4px',
            backgroundColor: 'white',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 100,
          }}
          onMouseEnter={() => setShowMenu(true)}
          onMouseLeave={handleMouseLeave}
        >
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
                setShowMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#6b7280',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
              data-testid={`hyperlink-edit-${hyperlink.id}`}
              title="Edit link"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setShowMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#6b7280',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
              data-testid={`hyperlink-delete-${hyperlink.id}`}
              title="Delete link"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
import {
  RenderBatchManager,
  VirtualizationManager,
  useRenderBatching,
} from "../utils/renderBatching";
import { useTelemetry, TelemetryEventType } from "../utils/telemetry";
import {
  useErrorRecovery,
  retryWithBackoff,
  withGracefulDegradation,
} from "../utils/errorRecovery";
import {
  MemoryManager,
  ProgressiveLoader,
  WorkerManager,
} from "../utils/scaleOptimizations";
import {
  RateLimiter,
  InputValidator,
  CSPManager,
  SecurityMonitor,
} from "../utils/securityHardening";

const renderTextWithLinks = (text: string): React.ReactNode => {
  if (!text) return null;
  
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    
    const linkText = match[1];
    let url = match[2];
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    parts.push(
      <a
        key={`link-${keyIndex++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {linkText}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${keyIndex++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : text;
};

// Floating workflow name input component
interface ProjectLink {
  id: string;
  text: string;
  url: string;
}

interface ProjectMetadata {
  name: string;
  description: string;
  links: ProjectLink[];
  linksFormat: "bulleted" | "text";
  categories: string[];
}

interface WorkflowNameInputProps {
  name: string;
  onChange: (name: string) => void;
  metadata?: ProjectMetadata;
  onMetadataChange?: (metadata: ProjectMetadata) => void;
}

const WorkflowNameInput: React.FC<WorkflowNameInputProps> = ({
  name,
  onChange,
  metadata,
  onMetadataChange,
}) => {
  const [mode, setMode] = useState<"collapsed" | "editing-name" | "expanded">(
    "collapsed",
  );
  const [inputValue, setInputValue] = useState(name);
  const [formData, setFormData] = useState<ProjectMetadata>(
    metadata || {
      name,
      description: "",
      links: [],
      linksFormat: "text",
      categories: [],
    },
  );
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({ text: "", url: "" });
  const [isJustSaved, setIsJustSaved] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const formDataRef = useRef(formData);
  const onMetadataChangeRef = useRef(onMetadataChange);
  const cleanupManager = useEventCleanup();

  const categorySuggestions = [
    "User Experience",
    "Feature Planning",
    "Brainstorming",
    "Collaboration",
    "Workshop",
    "Design System",
  ];

  // Update local state when props change
  useEffect(() => {
    setInputValue(name);
    setFormData((prev) => ({ ...prev, name }));
  }, [name]);

  // Keep refs in sync with latest values
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    onMetadataChangeRef.current = onMetadataChange;
  }, [onMetadataChange]);

  useEffect(() => {
    if (metadata && mode === "collapsed" && !isJustSaved) {
      // Only update formData when form is collapsed (not being actively edited) and not just saved
      setFormData(metadata);
    }
    if (isJustSaved) {
      // Clear the flag after preventing one reset
      setIsJustSaved(false);
    }
  }, [metadata, mode, isJustSaved]);

  // Handle keydown events for F2 and form interactions
  useEffect(() => {
    const handleKeyDown = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === "F2" && mode === "collapsed") {
        keyboardEvent.preventDefault();
        setMode("editing-name");
        cleanupManager.setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    const handleClickOutside = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      if (
        mode === "expanded" &&
        formRef.current &&
        !formRef.current.contains(mouseEvent.target as HTMLElement)
      ) {
        // Use refs to get the latest values instead of stale closure
        const latestFormData = formDataRef.current;
        onMetadataChangeRef.current?.(latestFormData);
        setIsJustSaved(true);
        setMode("collapsed");
      }
    };

    const cleanupKeydown = cleanupManager.addEventListener(
      document,
      "keydown",
      handleKeyDown,
    );
    const cleanupClick = cleanupManager.addEventListener(
      document,
      "mousedown",
      handleClickOutside,
    );
    return () => {
      cleanupKeydown();
      cleanupClick();
    };
  }, [mode]);

  const handleStartNameEdit = () => {
    setMode("editing-name");
    cleanupManager.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFinishNameEdit = () => {
    const newName = inputValue.trim() || "Untitled Workflow";
    setMode("collapsed");
    onChange(newName);
    setFormData((prev) => ({ ...prev, name: newName }));
  };

  const handleExpandForm = () => {
    setMode("expanded");
  };

  const handleSaveForm = () => {
    onMetadataChange?.(formData); // Save FIRST
    setIsJustSaved(true); // Prevent immediate metadata reset
    setMode("collapsed"); // Change mode AFTER
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFinishNameEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue(name);
      setMode("collapsed");
    }
  };

  const handleAddCategory = () => {
    const category = newCategory.trim();
    if (
      category &&
      formData.categories.length < 5 &&
      !formData.categories.includes(category)
    ) {
      setFormData((prev) => ({
        ...prev,
        categories: [...prev.categories, category],
      }));
      setNewCategory("");
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCategory();
    } else if (e.key === "Tab" && newCategory) {
      const suggestion = categorySuggestions.find((s) =>
        s.toLowerCase().startsWith(newCategory.toLowerCase()),
      );
      if (suggestion) {
        e.preventDefault();
        setNewCategory(suggestion);
        cleanupManager.setTimeout(() => handleAddCategory(), 0);
      }
    }
  };

  const handleRemoveCategory = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }));
  };

  const handleEditCategory = (index: number, value: string) => {
    if (editingCategory === formData.categories[index]) {
      setFormData((prev) => ({
        ...prev,
        categories: prev.categories.map((cat, i) =>
          i === index ? value : cat,
        ),
      }));
      setEditingCategory(null);
    } else {
      setEditingCategory(formData.categories[index]);
    }
  };

  const handleAddLink = () => {
    if (newLink.text.trim() && newLink.url.trim()) {
      setFormData((prev) => ({
        ...prev,
        links: [...prev.links, { ...newLink, id: Date.now().toString() }],
      }));
      setNewLink({ text: "", url: "" });
    }
  };

  const handleRemoveLink = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      links: prev.links.filter((link) => link.id !== id),
    }));
  };

  // Display mode - show card with content
  if (mode === "collapsed") {
    const hasContent =
      formData.description ||
      formData.links.length > 0 ||
      formData.categories.length > 0;

    if (!hasContent) {
      // Simple name display with chevron
      return (
        <div className="absolute top-4 left-52 z-30 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 px-2 py-1 text-lg font-medium text-gray-700 dark:text-gray-300 shadow-sm" style={{ borderRadius: '12px' }}>
          <span
            onClick={handleStartNameEdit}
            className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-100"
            title="Click to edit workflow name (or press F2)"
          >
            {name || "Untitled Workflow"}
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
      <div className="absolute top-4 left-52 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-3 max-w-80" style={{ borderRadius: '12px' }}>
        <div className="flex items-center justify-between mb-2">
          <h3
            onClick={handleStartNameEdit}
            className="text-lg font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            title="Click to edit workflow name"
          >
            {name || "Untitled Workflow"}
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
            {formData.linksFormat === "bulleted" ? (
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
  if (mode === "editing-name") {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleNameKeyDown}
        onBlur={handleFinishNameEdit}
        className="absolute top-4 left-52 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{
          minWidth: "200px",
          maxWidth: "400px",
          borderRadius: "12px",
        }}
        placeholder="Workflow name..."
      />
    );
  }

  // Expanded form mode
  return (
    <div
      ref={formRef}
      className="absolute top-4 left-52 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-4 w-96"
      style={{ borderRadius: '12px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          Project Details
        </h3>
        <button
          onClick={handleSaveForm}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Name Field */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="Project name..."
        />
      </div>

      {/* Description Field */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => {
            setFormData((prev) => {
              const newData = { ...prev, description: e.target.value };
              return newData;
            });
          }}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
          placeholder="Describe your project..."
          rows={3}
        />
      </div>

      {/* References & Links */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            References & Links
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setFormData((prev) => ({ ...prev, linksFormat: "text" }))
              }
              className={`p-1 rounded transition-colors ${formData.linksFormat === "text" ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title="Text format"
            >
              <Type size={12} />
            </button>
            <button
              onClick={() =>
                setFormData((prev) => ({ ...prev, linksFormat: "bulleted" }))
              }
              className={`p-1 rounded transition-colors ${formData.linksFormat === "bulleted" ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
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
            onChange={(e) =>
              setNewLink((prev) => ({ ...prev, text: e.target.value }))
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="Link text..."
          />
          <div className="flex gap-2">
            <input
              type="url"
              value={newLink.url}
              onChange={(e) =>
                setNewLink((prev) => ({ ...prev, url: e.target.value }))
              }
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
              <div
                key={link.id}
                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded"
              >
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
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category
        </label>
        <input
          ref={categoryRef}
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={handleCategoryKeyDown}
          disabled={formData.categories.length >= 5}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          placeholder={
            formData.categories.length >= 5
              ? "Maximum 5 categories"
              : "Type and press Enter..."
          }
        />
        <p className="text-xs text-gray-500 mt-1">
          Add multiple categories by using Enter to add another
        </p>

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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        categories: prev.categories.map((cat, i) =>
                          i === index ? e.target.value : cat,
                        ),
                      }))
                    }
                    onBlur={() => setEditingCategory(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
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

// Utility to parse color to RGB values
const parseColorToRGB = (color: string): { r: number; g: number; b: number } => {
  let r = 248, g = 250, b = 252; // Default light gray
  
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }
  
  return { r, g, b };
};

// Utility to calculate contrast text color (white or black) based on background
const getContrastTextColor = (backgroundColor: string): string => {
  const { r, g, b } = parseColorToRGB(backgroundColor);
  
  // Handle HSL colors separately
  if (backgroundColor.startsWith('hsl')) {
    const match = backgroundColor.match(/\d+\.?\d*/g);
    if (match && match.length >= 3) {
      const lightness = parseFloat(match[2]);
      return lightness > 50 ? '#0f172a' : '#ffffff';
    }
  }
  
  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark slate for light backgrounds
  return luminance > 0.5 ? '#0f172a' : '#ffffff';
};

// Utility to create a tinted body color from header color (10% intensity)
const getTintedBodyColor = (headerColor: string, intensity: number = 0.1): string => {
  const { r, g, b } = parseColorToRGB(headerColor);
  
  // Mix with white at the given intensity (10% color, 90% white)
  const mixedR = Math.round(255 * (1 - intensity) + r * intensity);
  const mixedG = Math.round(255 * (1 - intensity) + g * intensity);
  const mixedB = Math.round(255 * (1 - intensity) + b * intensity);
  
  return `#${mixedR.toString(16).padStart(2, '0')}${mixedG.toString(16).padStart(2, '0')}${mixedB.toString(16).padStart(2, '0')}`;
};

// Utility to calculate dynamic node height based on content
const calculateNodeHeight = (node: Node, nodeWidth: number): number => {
  const minHeight = 100;
  const maxHeight = 400;
  const titlePadding = 16; // Title padding (8px top + 8px bottom)
  const bodyPadding = 24; // Body padding (12px top + 12px bottom)
  const borderHeight = 2; // Border thickness

  // For image nodes with images, defer to explicit sizing
  if (node.type === "image" && node.data?.src) {
    return minHeight; // Will be overridden by explicit height anyway
  }

  // Get text content
  const titleText = node.data?.label || node.type || node.id;
  const bodyText = node.data?.description || "";

  // If no meaningful body content, stick to minimum
  if (
    !bodyText ||
    bodyText.trim() === "" ||
    bodyText.trim() === "Drop content here…"
  ) {
    return minHeight;
  }

  // More accurate character width estimation for 12px font
  const avgCharWidth = 7.2;
  const titleLineHeight = 15.6; // 12px * 1.3 line-height
  const bodyLineHeight = 16.8; // 12px * 1.4 line-height

  // Calculate available width for text (subtract padding)
  const titleAvailableWidth = nodeWidth - 24; // Title has same padding as body
  const bodyAvailableWidth = nodeWidth - 24;

  const titleCharsPerLine = Math.max(
    10,
    Math.floor(titleAvailableWidth / avgCharWidth),
  );
  const bodyCharsPerLine = Math.max(
    10,
    Math.floor(bodyAvailableWidth / avgCharWidth),
  );

  // Calculate lines needed for title
  const titleLines = Math.max(
    1,
    Math.ceil(titleText.length / titleCharsPerLine),
  );

  // Calculate lines needed for body text (handle newlines and wrapping)
  let bodyLines = 0;
  const textLines = bodyText.split("\n");
  for (const line of textLines) {
    if (line.trim() === "") {
      bodyLines += 1; // Empty line
    } else {
      bodyLines += Math.max(1, Math.ceil(line.length / bodyCharsPerLine));
    }
  }

  // Calculate total height
  const titleHeight = titleLines * titleLineHeight + titlePadding;
  const bodyHeight = Math.max(40, bodyLines * bodyLineHeight + bodyPadding); // Minimum 40px for body
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
  onConnect?: (c: { source: string; target: string; data?: { variableName?: string } }) => void;
  minZoom?: number;
  maxZoom?: number;
  fitView?: boolean;
  showMiniMap?: boolean;
  // Plugin system integration
  core?: KiteFrameCore;
  enablePlugins?: boolean;
  selectedNodes?: string[];
  onSelectionChange?: (nodeIds: string[]) => void;
  onNodeClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasClick?: () => void;
  onNodeDoubleClick?: (e: React.MouseEvent, node: Node, part?: 'header' | 'body') => void;
  onNodeRightClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasObjectClick?: (
    e: React.MouseEvent,
    canvasObject: CanvasObject,
  ) => void;
  onCanvasObjectDoubleClick?: (
    e: React.MouseEvent,
    canvasObject: CanvasObject,
  ) => void;
  onCanvasObjectRightClick?: (
    e: React.MouseEvent,
    canvasObject: CanvasObject,
  ) => void;
  onEdgeClick?: (e: React.MouseEvent, edge: Edge) => void;
  onNodeResize?: (id: string, w: number, h: number) => void;
  onImageButtonClick?: (nodeId: string) => void;
  onEdgeReconnect?: (
    edgeId: string,
    newSource: string,
    newTarget: string,
  ) => void;
  smartConnect?: boolean;
  snapToGuides?: boolean;
  snapToGrid?: boolean;
  className?: string;
  onImageUpload?: (id: string, data: string) => void;
  onImageUrlSet?: (id: string, url: string) => void;
  disablePan?: boolean;
  disableWheelZoom?: boolean;
  enableTouchGestures?: boolean;
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;

  // Pro Features
  proFeatures?: ProFeaturesConfig;
  onQuickAdd?: (
    sourceNode: Node,
    position: "top" | "right" | "bottom" | "left",
  ) => void;

  // Animation configuration for connection previews
  connectionAnimationConfig?: Partial<AnimationConfig>;

  // Connection preview state for ghost preview lines
  connectionPreview?: { source: string; target: string } | null;

  // Workflow name and metadata
  workflowName?: string;
  onWorkflowNameChange?: (name: string) => void;
  workflowMetadata?: ProjectMetadata;
  onWorkflowMetadataChange?: (metadata: ProjectMetadata) => void;

  // User identification for reactions and interactions
  currentUserId?: string;
  
  // Inline text editing state
  inlineEditing?: {
    nodeId?: string;
    edgeId?: string;
    part: 'header' | 'body' | 'edgeLabel';
  } | null;
  onInlineEditingSave?: (nodeId: string, part: 'header' | 'body', value: string) => void;
  onInlineEditingCancel?: () => void;
  onTextSelectionChange?: (selectedText: string) => void;
  
  // Hyperlink management callbacks
  onHyperlinkEdit?: (nodeId: string, hyperlinkId: string) => void;
  onHyperlinkDelete?: (nodeId: string, hyperlinkId: string) => void;
  
  // Text object hyperlink edit callback
  onTextObjectHyperlinkEdit?: (canvasObjectId: string) => void;
  
  // Table node callbacks
  tableData?: Record<string, import('../types').DataTable>;
  onOpenTable?: (tableId: string) => void;
  onTableDataChange?: (tableId: string, table: import('../types').DataTable) => void;
  onCreateNodeFromRow?: (tableId: string, row: Record<string, unknown>, rowIndex: number) => void;
  
  // Form node table linking callbacks
  onFormLinkTable?: (nodeId: string) => void;
  onFormUnlinkTable?: (nodeId: string) => void;
  onUpdateTableCell?: (tableId: string, rowId: string, columnId: string, value: string) => void;
  
  // Node focus callback - pan canvas to focus on a specific node
  onFocusNode?: (nodeId: string) => void;
  
  // Compound template callbacks
  onSaveAsTemplate?: (nodeId: string, templateName: string, description?: string) => void;
  savedTemplates?: import('../types').SavedCompoundTemplate[];
  onGenerateFromTemplate?: (tableId: string, template: import('../types').SavedCompoundTemplate, selectedRowIds?: string[]) => void;

  // Flow/Workflow settings (per-flow status tracking)
  flowSettings?: import('../utils/FlowDetection').FlowSettingsMap;
  onFlowSettingsChange?: (flowId: string, settings: import('../utils/FlowDetection').FlowSettings) => void;
  onResetFlowStatuses?: (flowId: string) => void;
  onThemeChangeRequested?: (flowId: string, nodeIds: string[]) => void;
  onApplyTheme?: (flowId: string, theme: import('../../../lib/themes').WorkflowTheme) => void;
  onDeleteWorkflow?: (flowId: string, nodeIds: string[]) => void;
  onDragWorkflow?: (flowId: string, nodeIds: string[], deltaX: number, deltaY: number, isDragStart?: boolean) => void;
  onLayoutWorkflow?: (flowId: string, nodeIds: string[], layoutType: 'hierarchical' | 'horizontal' | 'vertical') => void;

  // Node status change callback
  onNodeStatusChange?: (nodeId: string) => void;
  
  // Read-only mode: hides connection handles but allows node dragging for viewing
  readOnly?: boolean;
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
  const telemetry = useTelemetry();
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalViewport, setInternalViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const cleanupManager = useEventCleanup();
  const cleanupManagerRef = useRef(cleanupManager);

  // ========== PRODUCTION FEATURES INTEGRATION ==========
  // 1. Error Recovery System
  const { recoveryState, saveState, handleError } = useErrorRecovery();
  const [showRecoveryNotification, setShowRecoveryNotification] =
    useState(false);

  // 2. Memory Management System
  const memoryManager = useMemo(() => MemoryManager.getInstance(), []);
  const [memoryWarning, setMemoryWarning] = useState<{
    level: "warning" | "critical";
    percentage: number;
  } | null>(null);
  const progressiveLoader = useMemo(
    () =>
      new ProgressiveLoader({
        chunkSize: 50,
        priority: "viewport",
        maxConcurrent: 3,
      }),
    [],
  );
  const workerManager = useMemo(() => WorkerManager.getInstance(), []);

  // 3. Security Hardening System
  const actionRateLimiter = useMemo(
    () => new RateLimiter({ maxRequests: 30, windowMs: 1000 }),
    [],
  );
  const inputValidator = useMemo(() => InputValidator.getInstance(), []);
  const cspManager = useMemo(() => CSPManager.getInstance(), []);
  const securityMonitor = useMemo(() => SecurityMonitor.getInstance(), []);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);

  // Use external viewport if provided, otherwise use internal
  const viewport = props.viewport || internalViewport;
  const setViewport = props.onViewportChange || setInternalViewport;

  // Plugin system integration
  const core = props.core || kiteFrameCore;
  const enablePlugins = props.enablePlugins !== false; // Default to true

  // Configure AdvancedInteractionsPlugin with canvas objects for unified copy-paste
  useEffect(() => {
    if (enablePlugins && props.proFeatures) {
      const advancedInteractionsPlugin = core.getPlugin('advanced-interactions-pro') as any;
      if (advancedInteractionsPlugin && typeof advancedInteractionsPlugin.configure === 'function') {
        advancedInteractionsPlugin.configure(
          props.proFeatures,
          props.nodes,
          props.edges || [],
          props.onNodesChange || (() => {}),
          props.onEdgesChange,
          props.onConnect,
          props.canvasObjects || [],
          props.onCanvasObjectsChange
        );
      }
    }
  }, [enablePlugins, props.proFeatures, props.nodes, props.edges, props.canvasObjects, props.onNodesChange, props.onEdgesChange, props.onConnect, props.onCanvasObjectsChange, core]);

  // Update AdvancedInteractionsPlugin configuration when props change
  useEffect(() => {
    if (enablePlugins) {
      const advancedInteractionsPlugin = core.getPlugin('advanced-interactions-pro') as any;
      if (advancedInteractionsPlugin && typeof advancedInteractionsPlugin.updateConfiguration === 'function') {
        advancedInteractionsPlugin.updateConfiguration(
          props.proFeatures || {},
          props.nodes,
          props.canvasObjects || []
        );
      }
    }
  }, [enablePlugins, props.proFeatures, props.nodes, props.canvasObjects, core]);

  // Update viewport information in ProFeaturesManager for centered paste
  useEffect(() => {
    if (enablePlugins && containerRef.current) {
      const advancedInteractionsPlugin = core.getPlugin('advanced-interactions-pro') as any;
      if (advancedInteractionsPlugin && typeof advancedInteractionsPlugin.updateViewportInfo === 'function') {
        const containerRect = containerRef.current.getBoundingClientRect();
        advancedInteractionsPlugin.updateViewportInfo(viewport, {
          width: containerRect.width,
          height: containerRect.height
        });
      }
    }
  }, [enablePlugins, viewport, core]);

  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  // Unified Selection State (works for both nodes and canvas objects)
  const [unifiedSelectionRect, setUnifiedSelectionRect] = useState<null | {
    x: number;
    y: number;
    w: number;
    h: number;
  }>(null);
  const unifiedSelectStart = useRef<{ x: number; y: number } | null>(null);
  const justCompletedUnifiedSelection = useRef<boolean>(false);
  const justCompletedNodeDrag = useRef<boolean>(false);
  const justCompletedCanvasObjectDrag = useRef<boolean>(false);
  const selectionInProgress = useRef<boolean>(false);

  // DOM ref mapping for accurate bounds calculation
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const canvasObjectRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Helper functions for DOM bounds
  const registerNodeRef = (id: string, element: HTMLElement | null) => {
    if (element) {
      nodeRefs.current.set(id, element);
    } else {
      nodeRefs.current.delete(id);
    }
  };

  const registerCanvasObjectRef = (id: string, element: HTMLElement | null) => {
    if (element) {
      canvasObjectRefs.current.set(id, element);
    } else {
      canvasObjectRefs.current.delete(id);
    }
  };

  const getAccurateWorldBounds = (
    itemId: string,
    fallbackBounds: { x1: number; y1: number; x2: number; y2: number },
  ) => {
    const nodeElement = nodeRefs.current.get(itemId);
    const objectElement = canvasObjectRefs.current.get(itemId);
    const element = nodeElement || objectElement;

    if (element && containerRef.current) {
      try {
        const containerRect = containerRef.current.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Convert DOM bounds to world coordinates
        const topLeft = clientToWorld(
          elementRect.left - containerRect.left,
          elementRect.top - containerRect.top,
          viewport,
          containerRect,
        );
        const bottomRight = clientToWorld(
          elementRect.right - containerRect.left,
          elementRect.bottom - containerRect.top,
          viewport,
          containerRect,
        );

        return {
          x1: topLeft.x,
          y1: topLeft.y,
          x2: bottomRight.x,
          y2: bottomRight.y,
        };
      } catch (error) {
        console.warn("Failed to get accurate bounds for", itemId, error);
      }
    }

    // Fallback to stored dimensions with small margin for safety
    const margin = 5;
    return {
      x1: fallbackBounds.x1 - margin,
      y1: fallbackBounds.y1 - margin,
      x2: fallbackBounds.x2 + margin,
      y2: fallbackBounds.y2 + margin,
    };
  };

  // Constants
  const dragThreshold = 5; // pixels - threshold for distinguishing clicks from drags

  // Derived state for canvas object selection count
  const selectedCanvasObjectCount = (props.canvasObjects || []).filter(
    (obj) => obj.selected,
  ).length;
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);

  // Data Link Picker state for Form nodes
  const [dataLinkPicker, setDataLinkPicker] = useState<{
    isOpen: boolean;
    formNodeId: string;
    fieldId: string;
    currentLink?: {
      tableId: string;
      columnId: string;
      rowId: string;
      displayValue?: string;
    };
  } | null>(null);

  // Variable Name Dialog state for Table→Code connections
  const [pendingTableToCodeConnection, setPendingTableToCodeConnection] = useState<{
    sourceId: string;
    targetId: string;
    sourceNodeName: string;
  } | null>(null);
  const [variableNameInput, setVariableNameInput] = useState('');

  // Smart Guides state
  const [currentGuides, setCurrentGuides] = useState<SnapGuide[]>([]);
  
  // Drag optimization - suppress edges and show placeholder after 100px threshold
  const [suppressEdgesDuringDrag, setSuppressEdgesDuringDrag] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOptimizationThreshold = 100; // pixels before activating optimization

  // Pro Features Configuration
  const quickAddConfig = props.proFeatures?.quickAdd;
  const isQuickAddEnabled = quickAddConfig?.enabled !== false; // Default enabled
  const [quickAddButtons, setQuickAddButtons] = useState<
    Map<string, HTMLElement>
  >(new Map());
  const [ghostPreview, setGhostPreview] = useState<HTMLElement | null>(null);

  const minZoom = props.minZoom ?? 0.1;
  const maxZoom = props.maxZoom ?? 3;

  // ========== RENDER BATCHING & VIRTUALIZATION SETUP ==========
  // Virtualization Manager for viewport-based filtering
  const virtualizationManager = useMemo(() => new VirtualizationManager(), []);

  // Update virtualization viewport whenever viewport changes
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      virtualizationManager.setViewport(
        -viewport.x / viewport.zoom,
        -viewport.y / viewport.zoom,
        rect.width / viewport.zoom,
        rect.height / viewport.zoom,
      );
      virtualizationManager.setBuffer(200); // 200px buffer for smoother scrolling
    }
  }, [viewport, virtualizationManager]);

  // Render Batch Manager for optimized updates
  const handleBatchedUpdate = useCallback(
    (frame: any) => {
      // Process batched node updates
      if (frame.nodes.size > 0) {
        const updatedNodes = props.nodes.map((node) => {
          const updated = frame.nodes.get(node.id);
          return updated || node;
        });
        props.onNodesChange(updatedNodes);
      }

      // Process batched edge updates
      if (frame.edges.size > 0) {
        const updatedEdges = props.edges.map((edge) => {
          const updated = frame.edges.get(edge.id);
          return updated || edge;
        });
        props.onEdgesChange(updatedEdges);
      }

      // Process batched canvas object updates
      if (frame.objects.size > 0 && props.onCanvasObjectsChange) {
        const updatedObjects = (props.canvasObjects || []).map((obj) => {
          const updated = frame.objects.get(obj.id);
          return updated || obj;
        });
        props.onCanvasObjectsChange(updatedObjects);
      }
    },
    [props],
  );

  const renderBatchManager = useRenderBatching(handleBatchedUpdate, 60);

  // Filter visible nodes and edges based on viewport
  const visibleNodes = useMemo(() => {
    const nodeArray = props.nodes;
    return virtualizationManager.filterVisibleNodes(nodeArray, viewport.zoom);
  }, [props.nodes, viewport, virtualizationManager]);

  const visibleEdges = useMemo(() => {
    const nodesMap = new Map(props.nodes.map((n) => [n.id, n]));
    return virtualizationManager.filterVisibleEdges(
      props.edges,
      nodesMap,
      viewport.zoom,
    );
  }, [props.edges, props.nodes, viewport, virtualizationManager]);

  const visibleCanvasObjects = useMemo(() => {
    if (!props.canvasObjects) return [];
    // Disable virtualization for canvas objects to prevent disappearing at certain zoom levels
    // Canvas objects are typically fewer than nodes and need to always be visible
    return props.canvasObjects;
  }, [props.canvasObjects]);

  // Performance metrics in development mode
  const [showPerformance, setShowPerformance] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [metrics, setMetrics] = useState(renderBatchManager.getMetrics());

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && showMetrics) {
      const interval = setInterval(() => {
        setMetrics(renderBatchManager.getMetrics());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showMetrics, renderBatchManager]);

  // ResizeObserver to track ALL node dimension changes for accurate edge positioning
  // This ensures edges update their positions when node content expands or shrinks
  const resizeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const nodeDimensionCacheRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      const nodesToUpdate: Array<{id: string, width: number, height: number}> = [];
      
      for (const entry of entries) {
        const nodeElement = entry.target as HTMLElement;
        const nodeId = nodeElement.getAttribute('data-node-id');
        if (!nodeId) continue;
        
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        const cached = nodeDimensionCacheRef.current.get(nodeId) || { width: 0, height: 0 };
        
        // Only update if dimensions have actually changed significantly (to avoid loops)
        const widthChanged = Math.abs(newWidth - cached.width) > 2;
        const heightChanged = Math.abs(newHeight - cached.height) > 2;
        
        if (widthChanged || heightChanged) {
          nodeDimensionCacheRef.current.set(nodeId, { width: newWidth, height: newHeight });
          
          const borderWidth = 4; // Account for 2px borders on each side
          const totalWidth = newWidth + borderWidth;
          const totalHeight = newHeight + borderWidth;
          const minWidth = 120; // Minimum node width
          const minHeight = 80; // Minimum node height
          const finalWidth = Math.max(totalWidth, minWidth);
          const finalHeight = Math.max(totalHeight, minHeight);
          
          nodesToUpdate.push({ id: nodeId, width: finalWidth, height: finalHeight });
        }
      }
      
      if (nodesToUpdate.length > 0) {
        // Debounce the state update to avoid thrashing
        if (resizeDebounceRef.current) {
          clearTimeout(resizeDebounceRef.current);
        }
        
        resizeDebounceRef.current = setTimeout(() => {
          const updatedNodes = props.nodes.map(n => {
            const update = nodesToUpdate.find(u => u.id === n.id);
            if (update) {
              const modelWidth = n.measuredWidth || n.width || 200;
              const modelHeight = n.measuredHeight || n.height || 100;
              const widthDiff = Math.abs(update.width - modelWidth) > 2;
              const heightDiff = Math.abs(update.height - modelHeight) > 2;
              
              if (widthDiff || heightDiff) {
                return { 
                  ...n, 
                  measuredWidth: update.width,
                  measuredHeight: update.height 
                };
              }
            }
            return n;
          });
          
          // Only update if there were actual changes
          const hasChanges = updatedNodes.some((n, i) => n !== props.nodes[i]);
          if (hasChanges) {
            props.onNodesChange(updatedNodes);
          }
        }, 50); // 50ms debounce
      }
    });
    
    // Observe all node elements
    const nodeElements = containerRef.current.querySelectorAll('.kiteframe-node[data-node-id]');
    nodeElements.forEach(el => resizeObserver.observe(el));
    
    // Also observe for new nodes added to the container
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        Array.from(mutation.addedNodes).forEach((node) => {
          if (node instanceof HTMLElement) {
            const nodeEl = node.classList?.contains('kiteframe-node') ? node : node.querySelector?.('.kiteframe-node[data-node-id]');
            if (nodeEl) resizeObserver.observe(nodeEl);
          }
        });
      });
    });
    
    mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
    
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current);
      }
    };
  }, [props.nodes, props.onNodesChange]);

  // Keyboard event listener for Alt+P to toggle Performance element
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'p') {
        event.preventDefault();
        setShowPerformance(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ========== FREEFORM CREATION CLICK HANDLER ==========
  // Detect if there's a polygon shape in creation mode and handle canvas clicks
  const polygonCreatingShape = useMemo(() => {
    const creating = (props.canvasObjects || []).find(
      obj => obj.type === 'shape' && 
             (obj.data as any)?.shapeType === 'polygon' && 
             (obj.data as any)?.isCreating === true
    );
    return creating || null;
  }, [props.canvasObjects]);

  useEffect(() => {
    if (!polygonCreatingShape || !containerRef.current) return;

    const canvas = containerRef.current;
    const shapeData = polygonCreatingShape.data as any;
    const currentPoints = shapeData.points || [];
    
    const handleFreeformClick = (e: MouseEvent) => {
      // Only handle left clicks
      if (e.button !== 0) return;
      
      // Ignore clicks on UI elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('[role="button"]') || target.closest('[data-toolbar]')) {
        return;
      }
      
      const canvasRect = canvas.getBoundingClientRect();
      const zoom = viewport.zoom || 1;
      const viewportX = viewport.x || 0;
      const viewportY = viewport.y || 0;
      
      // Screen coordinates relative to canvas
      const screenX = e.clientX - canvasRect.left;
      const screenY = e.clientY - canvasRect.top;
      
      // Convert screen coordinates to world coordinates
      // CSS transform is: translate(viewport.x, viewport.y) scale(zoom)
      // So: screen = world * zoom + viewport
      // Inverting: world = (screen - viewport) / zoom
      const worldX = (screenX - viewportX) / zoom;
      const worldY = (screenY - viewportY) / zoom;
      
      // Convert to shape-local coordinates
      const localX = worldX - polygonCreatingShape.position.x;
      const localY = worldY - polygonCreatingShape.position.y;
      
      // Get fresh points from the shape (avoid stale closure)
      const freshShape = (props.canvasObjects || []).find(obj => obj.id === polygonCreatingShape.id);
      const freshPoints = (freshShape?.data as any)?.points || [];
      
      // Check if clicking near the first point to close the shape
      if (freshPoints.length >= 3) {
        const firstPt = freshPoints[0];
        const dist = Math.hypot(localX - firstPt.x, localY - firstPt.y);
        if (dist < 20) {
          const updatedObjects = (props.canvasObjects || []).map(obj =>
            obj.id === polygonCreatingShape.id
              ? { ...obj, data: { ...obj.data, isClosed: true, isCreating: false } }
              : obj
          );
          props.onCanvasObjectsChange?.(updatedObjects);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
      
      // Add the new point with bounds expansion
      const newPoints = [...freshPoints, { x: localX, y: localY }];
      
      // Calculate bounding box of all points
      const padding = 20;
      const minX = Math.min(...newPoints.map(p => p.x));
      const minY = Math.min(...newPoints.map(p => p.y));
      const maxX = Math.max(...newPoints.map(p => p.x));
      const maxY = Math.max(...newPoints.map(p => p.y));
      
      // Calculate new dimensions with padding
      const newWidth = Math.max(maxX - minX + padding * 2, 100);
      const newHeight = Math.max(maxY - minY + padding * 2, 100);
      
      // If points extend into negative local space, shift
      const shiftX = minX < padding ? minX - padding : 0;
      const shiftY = minY < padding ? minY - padding : 0;
      
      // Normalize points to new local origin
      const normalizedPoints = newPoints.map(p => ({
        x: p.x - shiftX,
        y: p.y - shiftY
      }));
      
      // Update world position to compensate for the shift
      const newPosition = {
        x: polygonCreatingShape.position.x + shiftX,
        y: polygonCreatingShape.position.y + shiftY
      };
      
      const updatedObjects = (props.canvasObjects || []).map(obj =>
        obj.id === polygonCreatingShape.id
          ? {
              ...obj,
              data: { ...obj.data, points: normalizedPoints },
              position: newPosition,
              width: newWidth,
              height: newHeight,
              style: { ...obj.style, width: newWidth, height: newHeight }
            }
          : obj
      );
      props.onCanvasObjectsChange?.(updatedObjects);
      
      e.stopPropagation();
      e.preventDefault();
    };
    
    const handleFreeformDoubleClick = (e: MouseEvent) => {
      // Get fresh points
      const freshShape = (props.canvasObjects || []).find(obj => obj.id === polygonCreatingShape.id);
      const freshPoints = (freshShape?.data as any)?.points || [];
      
      // Close the shape if we have at least 3 points
      if (freshPoints.length >= 3) {
        const updatedObjects = (props.canvasObjects || []).map(obj =>
          obj.id === polygonCreatingShape.id
            ? { ...obj, data: { ...obj.data, isClosed: true, isCreating: false } }
            : obj
        );
        props.onCanvasObjectsChange?.(updatedObjects);
        e.stopPropagation();
        e.preventDefault();
      }
    };
    
    // Add cursor style to indicate polygon mode
    canvas.style.cursor = 'crosshair';
    
    canvas.addEventListener('click', handleFreeformClick, true);
    canvas.addEventListener('dblclick', handleFreeformDoubleClick, true);
    
    return () => {
      canvas.style.cursor = '';
      canvas.removeEventListener('click', handleFreeformClick, true);
      canvas.removeEventListener('dblclick', handleFreeformDoubleClick, true);
    };
  }, [polygonCreatingShape, viewport, props.canvasObjects, props.onCanvasObjectsChange]);

  // ========== FLOW DETECTION FOR STATUS TRACKING ==========
  // Pre-compute flows and nodeToFlowIdMap for efficient lookup during node rendering
  const { flows, nodeToFlowIdMap } = useMemo(() => {
    const detectedFlows = FlowDetection.detectFlows(props.nodes, props.edges);
    const map = new Map<string, string>();
    
    detectedFlows.forEach(flow => {
      flow.nodes.forEach(node => {
        map.set(node.id, flow.id);
      });
    });
    
    return { flows: detectedFlows, nodeToFlowIdMap: map };
  }, [props.nodes, props.edges]);

  // ========== PRODUCTION FEATURES EFFECTS ==========
  // 1. Memory Monitoring
  useEffect(() => {
    const unsubscribe = memoryManager.onMemoryUpdate((metrics) => {
      const percentage = metrics.percentage;
      if (percentage > 0.95) {
        setMemoryWarning({ level: "critical", percentage });
      } else if (percentage > 0.8) {
        setMemoryWarning({ level: "warning", percentage });
      } else {
        setMemoryWarning(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [memoryManager]);

  // 2. Auto-save state for error recovery
  useEffect(() => {
    const saveInterval = setInterval(() => {
      try {
        saveState(props.nodes, props.edges, viewport);
      } catch (error) {
        console.error("Failed to save state:", error);
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [props.nodes, props.edges, viewport, saveState]);

  // 3. Recovery state handling
  useEffect(() => {
    if (recoveryState) {
      setShowRecoveryNotification(true);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setShowRecoveryNotification(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [recoveryState]);

  // 4. Security monitoring
  useEffect(() => {
    const unsubscribe = securityMonitor.onSecurityEvent((event) => {
      if (event.type === "rate-limit" && event.blocked) {
        setRateLimitWarning(true);
        setTimeout(() => setRateLimitWarning(false), 3000);
      }
    });

    return () => unsubscribe();
  }, [securityMonitor]);

  // Pro Features: Quick Add Functions
  const createQuickAddNode = (
    sourceNode: Node,
    position: "top" | "right" | "bottom" | "left",
  ): Node => {
    const spacing = quickAddConfig?.defaultSpacing ?? 250;
    const nodeType = quickAddConfig?.defaultNodeType ?? "process";
    const template = quickAddConfig?.defaultNodeTemplate ?? {};

    let newPosition = { x: 0, y: 0 };
    switch (position) {
      case "top":
        newPosition = {
          x: sourceNode.position.x,
          y: sourceNode.position.y - spacing,
        };
        break;
      case "right":
        newPosition = {
          x: sourceNode.position.x + spacing,
          y: sourceNode.position.y,
        };
        break;
      case "bottom":
        newPosition = {
          x: sourceNode.position.x,
          y: sourceNode.position.y + spacing,
        };
        break;
      case "left":
        newPosition = {
          x: sourceNode.position.x - spacing,
          y: sourceNode.position.y,
        };
        break;
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: newPosition,
      data: {
        label: "New Process",
        description: "Configure process settings",
        icon: "Cog",
        iconColor: "text-gray-500",
        ...template,
      },
      width: 200,
      height: 100,
    };

    return newNode;
  };

  const handleQuickAdd = (
    sourceNode: Node,
    position: "top" | "right" | "bottom" | "left",
  ) => {
    const newNode = createQuickAddNode(sourceNode, position);

    // Queue the new node update through batch manager
    renderBatchManager.queueUpdate({
      id: newNode.id,
      type: "node",
      operation: "add",
      data: newNode,
      priority: "high",
    });

    // Still need to update immediately for consistency
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
    const explicitHeight =
      n.style?.height ??
      (n.type === "image" && n.data?.src ? n.height : undefined);
    const h = explicitHeight ?? Math.max(dynamicHeight, n.height ?? 100);
    return {
      x: n.position.x,
      y: n.position.y,
      w,
      h,
      cx: n.position.x + w / 2,
      cy: n.position.y + h / 2,
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
    props.edges.some((e) => e.source === sourceId && e.target === targetId);

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

  // Wheel/pinch zoom (cursor-anchored) - using native event for passive: false
  const handleWheel = useCallback((e: WheelEvent) => {
    // Check if the wheel event originated inside a scrollable table content area
    const target = e.target as HTMLElement;
    const scrollableTable = target.closest('[data-table-scrollable="true"]');
    if (scrollableTable) {
      // Don't intercept - let the table handle its own scrolling
      return;
    }
    
    e.preventDefault();
    
    // Skip zoom if disabled, but still prevent default scroll behavior
    if (props.disableWheelZoom) {
      return;
    }
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const old = viewport;
    const newZoom = zoomAroundPoint(
      old.zoom,
      e.deltaY * 0.00225,
      minZoom,
      maxZoom,
    );
    const mouseWorld = clientToWorld(e.clientX, e.clientY, old, rect);
    const newX = e.clientX - rect.left - mouseWorld.x * newZoom;
    const newY = e.clientY - rect.top - mouseWorld.y * newZoom;
    setViewport({ x: newX, y: newY, zoom: newZoom });

    // Track viewport zoom
    telemetry.track(TelemetryEventType.VIEWPORT_UPDATE, {
      category: "viewport",
      action: "zoom",
      value: newZoom,
      metadata: { zoom: newZoom, method: "wheel" },
    });
  }, [viewport, setViewport, props.disableWheelZoom, telemetry]);
  
  // Attach wheel event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Touch gesture handling - DISABLED due to conflicts with node drag interactions
  // The enableTouchGestures prop is preserved for future implementation but currently non-functional
  // Mobile users can use the minimap or toolbar controls for zoom/pan instead
  const enableTouchGestures = props.enableTouchGestures !== false;
  
  // Prevent Safari gesture events (prevents browser zoom on iOS)
  useEffect(() => {
    if (!enableTouchGestures) return;
    
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    
    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    };
  }, [enableTouchGestures]);

  // Function to start unified selection - can be called from anywhere
  const startUnifiedSelection = (clientX: number, clientY: number) => {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;

    unifiedSelectStart.current = { x: containerX, y: containerY };
    setUnifiedSelectionRect({ x: containerX, y: containerY, w: 0, h: 0 });
    selectionInProgress.current = true;
  };

  // Background interactions: pan or selection (Shift+drag)
  const onBackgroundDown = (e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    if (isShift) {
      e.preventDefault();
      e.stopPropagation();
      startUnifiedSelection(e.clientX, e.clientY);

      // Track selection start
      telemetry.track(TelemetryEventType.CANVAS_INTERACTION, {
        category: "selection",
        action: "start",
        metadata: { method: "shift-drag" },
      });
    } else if (!props.disablePan) {
      setPanning(true);
      panStart.current = {
        x: e.clientX - viewport.x,
        y: e.clientY - viewport.y,
      };

      // Track pan start
      telemetry.track(TelemetryEventType.CANVAS_INTERACTION, {
        category: "pan",
        action: "start",
      });
    }
  };

  const onBackgroundMove = (e: React.MouseEvent) => {
    if (panning && panStart.current) {
      const panStartRef = panStart.current; // Capture reference to avoid race condition
      setViewport({
        ...viewport,
        x: e.clientX - panStartRef.x,
        y: e.clientY - panStartRef.y,
      });
      return;
    }

    // Handle unified selection rectangle
    if (unifiedSelectStart.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;
      const sx = unifiedSelectStart.current.x,
        sy = unifiedSelectStart.current.y;
      setUnifiedSelectionRect({
        x: Math.min(sx, containerX),
        y: Math.min(sy, containerY),
        w: Math.abs(containerX - sx),
        h: Math.abs(containerY - sy),
      });
      return;
    }
    // Handle node dragging (SmartConnect plugin notification)
    if (dragInfo.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const wpos = clientToWorld(e.clientX, e.clientY, viewport, rect);

      // Calculate new position based on drag movement
      const dx = wpos.x - dragInfo.current.start.x;
      const dy = wpos.y - dragInfo.current.start.y;

      if (dragInfo.current.isGroupDrag) {
        // Group drag - update all selected nodes
        const selectedNodes = props.nodes.filter(
          (node) => node.selected === true,
        );
        const updatedNodes = props.nodes.map((node) => {
          if (node.selected) {
            const origin =
              dragInfo.current && dragInfo.current.origins
                ? dragInfo.current.origins.find((o) => o.id === node.id)
                    ?.origin || node.position
                : node.position;
            const newPosition = { x: origin.x + dx, y: origin.y + dy };

            return { ...node, position: newPosition };
          }
          return node;
        });

        // Queue batch updates for group drag
        const updates = updatedNodes
          .filter((n) => n.selected)
          .map((node) => ({
            id: node.id,
            type: "node" as const,
            operation: "update" as const,
            data: node,
            priority: "high" as const,
          }));
        renderBatchManager.queueBatch(updates);

        // Still update immediately for responsiveness
        props.onNodesChange(updatedNodes);
      } else {
        // Single node drag
        const targetNode = props.nodes.find(
          (n) => n.id === dragInfo.current!.id,
        );
        if (targetNode) {
          const newPosition = {
            x: dragInfo.current.origin.x + dx,
            y: dragInfo.current.origin.y + dy,
          };
          const updatedNodes = props.nodes.map((node) =>
            node.id === dragInfo.current!.id
              ? { ...node, position: newPosition }
              : node,
          );

          // Queue single node update through batch manager
          renderBatchManager.queueUpdate({
            id: dragInfo.current!.id,
            type: "node",
            operation: "update",
            data: { ...targetNode, position: newPosition },
            priority: "high",
          });

          // Still update immediately for responsiveness
          props.onNodesChange(updatedNodes);

          // Notify SmartConnectPlugin during drag
          if (
            enablePlugins &&
            props.proFeatures?.smartConnect?.enabled !== false
          ) {
            const smartConnectPlugin = core.getPlugin("smart-connect-pro");
            if (smartConnectPlugin) {
              (smartConnectPlugin as any).handleDrag?.(
                dragInfo.current.id,
                newPosition,
              );
            }
          }
        }
      }
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
        eligible =
          target.id !== connecting.sourceId &&
          !edgeExists(connecting.sourceId, target.id);
      }
      setConnecting((c) =>
        c ? { ...c, wx: wpos.x, wy: wpos.y, hoverTargetId, eligible } : null,
      );
      return;
    }
  };

  // Helper function to get canvas object bounding box
  const getCanvasObjectRect = (obj: CanvasObject) => {
    const width = obj.style?.width || obj.width || 200;
    const height = obj.style?.height || obj.height || 150;
    return {
      x: obj.position.x,
      y: obj.position.y,
      w: width,
      h: height,
      x1: obj.position.x,
      y1: obj.position.y,
      x2: obj.position.x + width,
      y2: obj.position.y + height,
    };
  };

  const onBackgroundUp = (e: React.MouseEvent) => {
    if (panning) {
      setPanning(false);
      panStart.current = null;
    }

    // Handle unified selection completion (both nodes and canvas objects)
    if (unifiedSelectStart.current) {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current!.getBoundingClientRect();
      const r = unifiedSelectionRect!;
      const isShiftHeld = e.shiftKey;

      // Convert selection rectangle coordinates from screen space to world space
      const startWorld = clientToWorld(r.x, r.y, viewport, rect);
      const endWorld = clientToWorld(r.x + r.w, r.y + r.h, viewport, rect);

      const nx1 = Math.min(startWorld.x, endWorld.x);
      const ny1 = Math.min(startWorld.y, endWorld.y);
      const nx2 = Math.max(startWorld.x, endWorld.x);
      const ny2 = Math.max(startWorld.y, endWorld.y);

      // Select nodes that intersect with selection rectangle
      const updatedNodes = props.nodes.map((n) => {
        // Start with fallback bounds from stored dimensions
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const fallbackBounds = {
          x1: n.position.x,
          y1: n.position.y,
          x2: n.position.x + w,
          y2: n.position.y + h,
        };

        // Get accurate DOM bounds if available
        const nodeBounds = getAccurateWorldBounds(n.id, fallbackBounds);

        // Use overlap detection instead of complete containment
        const overlapsX = nodeBounds.x1 < nx2 && nodeBounds.x2 > nx1;
        const overlapsY = nodeBounds.y1 < ny2 && nodeBounds.y2 > ny1;
        const intersectsWithLasso = overlapsX && overlapsY;

        // Handle additive vs replacement selection
        let selected: boolean;
        if (isShiftHeld) {
          // Additive selection: preserve existing selection, add intersecting items
          selected = n.selected || intersectsWithLasso;
        } else {
          // Replacement selection: only select intersecting items
          selected = intersectsWithLasso;
        }

        return { ...n, selected };
      });

      // Select canvas objects that intersect with selection rectangle
      const updatedObjects = (props.canvasObjects || []).map((obj) => {
        // Get fallback bounds from stored dimensions
        const objRect = getCanvasObjectRect(obj);

        // Get accurate DOM bounds if available
        const accurateBounds = getAccurateWorldBounds(obj.id, objRect);

        // Use overlap detection instead of complete containment
        const overlapsX = accurateBounds.x1 < nx2 && accurateBounds.x2 > nx1;
        const overlapsY = accurateBounds.y1 < ny2 && accurateBounds.y2 > ny1;
        const intersectsWithLasso = overlapsX && overlapsY;

        // Handle additive vs replacement selection
        let selected: boolean;
        if (isShiftHeld) {
          // Additive selection: preserve existing selection, add intersecting items
          selected = obj.selected || intersectsWithLasso;
        } else {
          // Replacement selection: only select intersecting items
          selected = intersectsWithLasso;
        }

        return { ...obj, selected };
      });

      // Update both nodes and canvas objects
      props.onNodesChange(updatedNodes);
      props.onCanvasObjectsChange?.(updatedObjects);

      // Clean up unified selection state
      setUnifiedSelectionRect(null);
      unifiedSelectStart.current = null;
      selectionInProgress.current = false;
      justCompletedUnifiedSelection.current = true;
      cleanupManagerRef.current?.setTimeout(() => {
        justCompletedUnifiedSelection.current = false;
      }, 100);
      return; // Don't trigger onClick
    }

    if (connecting) {
      const { sourceId, hoverTargetId, eligible } = connecting;

      // Helper to check if connection is table/form→code and needs variable name dialog
      const checkAndHandleTableToCodeConnection = (source: string, target: string): boolean => {
        const sourceNode = props.nodes.find(n => n.id === source);
        const targetNode = props.nodes.find(n => n.id === target);
        
        if ((sourceNode?.type === 'table' || sourceNode?.type === 'form') && targetNode?.type === 'code') {
          // Get source node name for the dialog
          const sourceNodeName = (sourceNode.data as any)?.label || 
                                 (sourceNode.data as any)?.title || 
                                 (sourceNode.type === 'table' ? 'Table' : 'Form');
          
          // Show variable name dialog
          setPendingTableToCodeConnection({
            sourceId: source,
            targetId: target,
            sourceNodeName,
          });
          // Suggest a camelCase variable name based on source node name
          const suggestedName = sourceNodeName
            .toLowerCase()
            .replace(/[^a-z0-9]+(.)/g, (_: string, char: string) => char.toUpperCase())
            .replace(/[^a-zA-Z0-9]/g, '') || 'data';
          setVariableNameInput(suggestedName);
          return true; // Connection intercepted
        }
        return false; // Normal connection
      };

      // If hovering a valid node, connect directly (no need to land on handle)
      if (hoverTargetId && eligible) {
        if (!checkAndHandleTableToCodeConnection(sourceId, hoverTargetId)) {
          props.onConnect?.({ source: sourceId, target: hoverTargetId });
        }
        setConnecting(null);
        return;
      }

      // fallback: nearest-handle threshold logic (optional)
      const rect = containerRef.current!.getBoundingClientRect();
      const world = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const threshold = 16;
      let best: { id: string; dist: number } | null = null;
      for (const n of props.nodes) {
        if (n.id === sourceId) continue;
        const w = n.style?.width ?? n.width ?? 200;
        const h = n.style?.height ?? n.height ?? 100;
        const handles = [
          { x: n.position.x + w / 2, y: n.position.y },
          { x: n.position.x + w / 2, y: n.position.y + h },
          { x: n.position.x, y: n.position.y + h / 2 },
          { x: n.position.x + w, y: n.position.y + h / 2 },
        ];
        for (const pt of handles) {
          const d = Math.hypot(pt.x - world.x, pt.y - world.y);
          if (d < threshold && (!best || d < best.dist))
            best = { id: n.id, dist: d };
        }
      }
      if (best && !edgeExists(sourceId, best.id)) {
        if (!checkAndHandleTableToCodeConnection(sourceId, best.id)) {
          props.onConnect?.({ source: sourceId, target: best.id });
        }
      }
      setConnecting(null);
    }
  };

  // Node dragging with group support
  const dragInfo = useRef<{
    id: string;
    start: { x: number; y: number };
    origin: { x: number; y: number };
    origins?: { id: string; origin: { x: number; y: number } }[];
    canvasObjectOrigins?: { id: string; origin: { x: number; y: number } }[];
    isGroupDrag?: boolean;
  } | null>(null);
  
  // Performance: RAF throttling for drag updates
  const dragRafId = useRef<number | null>(null);
  const pendingDragUpdate = useRef<{ dx: number; dy: number } | null>(null);
  
  // Debug: Drag performance logging (enabled via console: window.KITEFRAME_DEBUG_DRAG = true)
  const lastDragLogTime = useRef<number>(0);
  const lastCursorPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartTime = useRef<number>(0);
  const frameCount = useRef<number>(0);

  // Canvas object dragging with threshold-based click vs drag distinction
  const canvasObjectDragInfo = useRef<{
    id: string;
    start: { x: number; y: number };
    last: { x: number; y: number };
    origin: { x: number; y: number };
    hasMoved: boolean;
    originalEvent: React.MouseEvent; // Store original event for proper click handling
  } | null>(null);

  // Endpoint dragging for arrow/line shapes
  const endpointDragInfo = useRef<{
    objectId: string;
    endpoint: 'start' | 'end';
    start: { x: number; y: number };
    origin: { x: number; y: number };
  } | null>(null);

  // Add capture-phase mousedown handler for shift+drag lasso from anywhere
  useEffect(() => {
    const handleCaptureMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;

      if (mouseEvent.shiftKey && containerRef.current) {
        // Check if target is not an input or contentEditable to avoid interfering with text editing
        const target = mouseEvent.target as HTMLElement;
        const isTextEditable =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.contentEditable === "true";

        if (isTextEditable) {
          return;
        }

        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        startUnifiedSelection(mouseEvent.clientX, mouseEvent.clientY);
      }
    };

    // Use document to capture shift+mousedown anywhere within the canvas area
    const cleanupCaptureMouseDown = cleanupManagerRef.current?.addEventListener(
      document,
      "mousedown",
      handleCaptureMouseDown,
      { capture: true },
    );
    return () => {
      cleanupCaptureMouseDown?.();
    };
  }, []);

  // Simple drag tracking without interference
  useEffect(() => {
    const onMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      // Handle endpoint dragging for arrow/line shapes
      if (endpointDragInfo.current) {
        handleEndpointDragMove(mouseEvent);
        return;
      }

      // Handle node dragging
      if (dragInfo.current) {
        handleNodeDragMove(mouseEvent);
        return;
      }

      // Handle canvas object dragging
      if (canvasObjectDragInfo.current) {
        handleCanvasObjectDragMove(mouseEvent);
        return;
      }
    };

    const handleEndpointDragMove = (e: MouseEvent) => {
      if (!endpointDragInfo.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      
      // Calculate delta from drag start
      const startWorld = clientToWorld(
        endpointDragInfo.current.start.x,
        endpointDragInfo.current.start.y,
        viewport,
        rect
      );
      const dx = wp.x - startWorld.x;
      const dy = wp.y - startWorld.y;

      // Calculate new endpoint position
      const newEndpointPos = {
        x: endpointDragInfo.current.origin.x + dx,
        y: endpointDragInfo.current.origin.y + dy,
      };

      // Update the canvas object with new endpoint position
      const updatedObjects = (props.canvasObjects || []).map((obj) => {
        if (obj.id !== endpointDragInfo.current!.objectId) return obj;
        
        const updateKey = endpointDragInfo.current!.endpoint === 'start' ? 'startPoint' : 'endPoint';
        return {
          ...obj,
          data: {
            ...obj.data,
            [updateKey]: newEndpointPos,
          },
        };
      });
      
      props.onCanvasObjectsChange?.(updatedObjects);
    };

    const handleNodeDragMove = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      
      const now = performance.now();
      const rect = containerRef.current!.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
      const dx = wp.x - dragInfo.current.start.x;
      const dy = wp.y - dragInfo.current.start.y;

      // Calculate drag distance in screen pixels for optimization threshold
      const dragDistance = Math.sqrt(dx * dx + dy * dy) * viewport.zoom;
      
      // Activate drag optimization (edge suppression + placeholder) after threshold
      if (dragDistance > dragOptimizationThreshold && !suppressEdgesDuringDrag) {
        setSuppressEdgesDuringDrag(true);
        setDraggingNodeId(dragInfo.current.id);
        dragStartTime.current = now;
        frameCount.current = 0;
      }
      
      // DEBUG LOGGING: Capture drag performance metrics
      const debugEnabled = typeof window !== 'undefined' && (window as any).KITEFRAME_DEBUG_DRAG;
      if (debugEnabled) {
        frameCount.current++;
        const cursorSpeed = lastCursorPos.current 
          ? Math.sqrt(
              Math.pow(e.clientX - lastCursorPos.current.x, 2) + 
              Math.pow(e.clientY - lastCursorPos.current.y, 2)
            ) / Math.max(1, now - lastDragLogTime.current) * 1000
          : 0;
        
        const nodePos = props.nodes.find(n => n.id === dragInfo.current?.id)?.position;
        const timeSinceLastLog = now - lastDragLogTime.current;
        const totalDragTime = now - dragStartTime.current;
        
        console.log(
          `🎯 DRAG[${frameCount.current}] ` +
          `cursor:(${e.clientX.toFixed(0)},${e.clientY.toFixed(0)}) ` +
          `speed:${cursorSpeed.toFixed(1)}px/s ` +
          `node:(${nodePos?.x.toFixed(0) ?? '?'},${nodePos?.y.toFixed(0) ?? '?'}) ` +
          `delta:(${dx.toFixed(1)},${dy.toFixed(1)}) ` +
          `dist:${dragDistance.toFixed(1)}px ` +
          `frameDelay:${timeSinceLastLog.toFixed(1)}ms ` +
          `totalTime:${totalDragTime.toFixed(0)}ms ` +
          `nodeId:${dragInfo.current.id} ` +
          `placeholderActive:${draggingNodeId === dragInfo.current.id}`
        );
        
        lastCursorPos.current = { x: e.clientX, y: e.clientY };
        lastDragLogTime.current = now;
      }
      
      // PERFORMANCE: Use RAF throttling to batch mouse events - only one position update per frame
      pendingDragUpdate.current = { dx, dy };
      
      if (dragRafId.current === null) {
        dragRafId.current = requestAnimationFrame(() => {
          if (!dragInfo.current || !pendingDragUpdate.current) {
            dragRafId.current = null;
            return;
          }
          
          const { dx: rafDx, dy: rafDy } = pendingDragUpdate.current;
          pendingDragUpdate.current = null;
          dragRafId.current = null;
          
          executeDragUpdate(rafDx, rafDy);
        });
      }
    };
    
    // Separated drag update logic for RAF batching
    const executeDragUpdate = (dx: number, dy: number) => {
      if (!dragInfo.current) return;
      
      // DEBUG LOGGING: Log RAF execution timing
      const debugEnabled = typeof window !== 'undefined' && (window as any).KITEFRAME_DEBUG_DRAG;
      if (debugEnabled) {
        const rafTime = performance.now();
        const rafDelay = rafTime - lastDragLogTime.current;
        console.log(
          `⚡ RAF_EXEC ` +
          `rafDelay:${rafDelay.toFixed(1)}ms ` +
          `dx:${dx.toFixed(1)} dy:${dy.toFixed(1)} ` +
          `nodeId:${dragInfo.current.id}`
        );
      }

      if (dragInfo.current.isGroupDrag && dragInfo.current.origins) {
        // Group drag: move all selected nodes
        const updatedNodes = props.nodes.map((n) => {
          const nodeOrigin = dragInfo.current!.origins!.find(
            (o) => o.id === n.id,
          );
          if (nodeOrigin) {
            return {
              ...n,
              position: {
                x: nodeOrigin.origin.x + dx,
                y: nodeOrigin.origin.y + dy,
              },
            };
          }
          return n;
        });

        // Group drag: also move all selected canvas objects
        const updatedCanvasObjects = (props.canvasObjects || []).map((obj) => {
          const objectOrigin = dragInfo.current!.canvasObjectOrigins?.find(
            (o) => o.id === obj.id,
          );
          if (objectOrigin) {
            return {
              ...obj,
              position: {
                x: objectOrigin.origin.x + dx,
                y: objectOrigin.origin.y + dy,
              },
            };
          }
          return obj;
        });

        props.onNodesChange(updatedNodes);
        if (
          dragInfo.current.canvasObjectOrigins &&
          dragInfo.current.canvasObjectOrigins.length > 0
        ) {
          props.onCanvasObjectsChange?.(updatedCanvasObjects);
        }
      } else {
        // Individual drag: move single node with smart guides
        const id = dragInfo.current.id;
        const targetPosition = {
          x: dragInfo.current!.origin.x + dx,
          y: dragInfo.current!.origin.y + dy,
        };

        // Apply smart guides if enabled
        let finalPosition = targetPosition;
        let currentGuides: SnapGuide[] = [];

        // Only apply snapping if explicitly enabled (not just "not false")
        const smartGuidesEnabled = props.proFeatures?.smartGuides?.enabled === true;
        
        if (smartGuidesEnabled) {
          const draggedNode = props.nodes.find((n) => n.id === id);
          if (draggedNode) {
            const smartGuidesConfig = props.proFeatures!.smartGuides!;
            const snapSettings = {
              enabled: true,
              threshold:
                smartGuidesConfig.threshold || defaultSnapSettings.threshold,
              showGuides: smartGuidesConfig.showGuides === true,
              snapToNodes: smartGuidesConfig.snapToNodes === true,
              snapToGrid: smartGuidesConfig.snapToGrid === true,
              gridSize:
                smartGuidesConfig.gridSize || defaultSnapSettings.gridSize,
              snapToCanvas: smartGuidesConfig.snapToCanvas === true,
            };

            const canvasSize = { width: 2000, height: 1500 };
            const snapResult = calculateSnapPosition(
              draggedNode,
              targetPosition,
              props.nodes,
              canvasSize,
              snapSettings,
            );

            finalPosition = snapResult.position;
            setCurrentGuides(snapResult.guides);
          }
        } else {
          // Clear any existing guides when snapping is disabled
          setCurrentGuides([]);
        }

        const updated = props.nodes.map((n) =>
          n.id === id ? { ...n, position: finalPosition } : n,
        );
        props.onNodesChange(updated);

        // Notify SmartConnectPlugin of drag movement for real-time preview
        if (
          enablePlugins &&
          props.proFeatures?.smartConnect?.enabled !== false
        ) {
          const smartConnectPlugin = core.getPlugin("smart-connect-pro");
          if (smartConnectPlugin) {
            // Call the plugin's handleDrag method to show connection preview
            (smartConnectPlugin as any).handleDrag?.(id, finalPosition);
          }
        }
      }
    };

    const handleCanvasObjectDragMove = (e: MouseEvent) => {
      if (!canvasObjectDragInfo.current) return;

      const rect = containerRef.current!.getBoundingClientRect();
      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);

      // Check movement threshold (5px in screen coordinates, zoom-invariant) to distinguish drag from click
      const screenThreshold = 5; // pixels in screen space
      const worldThreshold = screenThreshold / viewport.zoom; // Convert to world coordinates
      const distance = Math.sqrt(
        Math.pow(wp.x - canvasObjectDragInfo.current.start.x, 2) +
          Math.pow(wp.y - canvasObjectDragInfo.current.start.y, 2),
      );

      // Only start actual dragging after movement threshold is exceeded
      if (distance > worldThreshold && !canvasObjectDragInfo.current.hasMoved) {
        canvasObjectDragInfo.current.hasMoved = true;
      }

      // Only update position if we're actually dragging (not just tracking potential drag)
      if (!canvasObjectDragInfo.current.hasMoved) {
        canvasObjectDragInfo.current.last = wp;
        return;
      }

      const dx = wp.x - canvasObjectDragInfo.current.start.x;
      const dy = wp.y - canvasObjectDragInfo.current.start.y;

      const newPosition = {
        x: canvasObjectDragInfo.current.origin.x + dx,
        y: canvasObjectDragInfo.current.origin.y + dy,
      };

      // Apply smart guides if enabled
      let finalPosition = newPosition;
      let currentGuides: SnapGuide[] = [];

      // Only apply snapping if explicitly enabled
      const canvasObjectSnapEnabled = props.proFeatures?.smartGuides?.enabled === true;
      
      if (canvasObjectSnapEnabled) {
        const allOtherObjects = [
          ...props.nodes.map((n) => ({ ...getNodeRect(n), id: n.id })),
          ...(props.canvasObjects || [])
            .filter((obj) => obj.id !== canvasObjectDragInfo.current!.id)
            .map((obj) => ({
              x: obj.position.x,
              y: obj.position.y,
              w: obj.style?.width || obj.width || 200,
              h: obj.style?.height || obj.height || 150,
              id: obj.id,
            })),
        ];

        const draggedObjectSize = {
          w:
            (props.canvasObjects || []).find(
              (obj) => obj.id === canvasObjectDragInfo.current!.id,
            )?.style?.width ||
            (props.canvasObjects || []).find(
              (obj) => obj.id === canvasObjectDragInfo.current!.id,
            )?.width ||
            200,
          h:
            (props.canvasObjects || []).find(
              (obj) => obj.id === canvasObjectDragInfo.current!.id,
            )?.style?.height ||
            (props.canvasObjects || []).find(
              (obj) => obj.id === canvasObjectDragInfo.current!.id,
            )?.height ||
            150,
        };

        // Create a temporary node-like object for the dragged canvas object
        const draggedObjectAsNode = {
          id: canvasObjectDragInfo.current!.id,
          position: newPosition,
          width: draggedObjectSize.w,
          height: draggedObjectSize.h,
        } as Node;

        const smartGuidesConfig = props.proFeatures!.smartGuides!;
        const snapSettings = {
          enabled: true,
          threshold: smartGuidesConfig.threshold || defaultSnapSettings.threshold,
          showGuides: smartGuidesConfig.showGuides === true,
          snapToNodes: smartGuidesConfig.snapToNodes === true,
          snapToGrid: smartGuidesConfig.snapToGrid === true,
          gridSize: smartGuidesConfig.gridSize || defaultSnapSettings.gridSize,
          snapToCanvas: smartGuidesConfig.snapToCanvas === true,
        };

        const snapResult = calculateSnapPosition(
          draggedObjectAsNode,
          newPosition,
          props.nodes,
          { width: 2000, height: 2000 },
          snapSettings,
        );

        finalPosition = snapResult.position;
        currentGuides = snapResult.guides;
        setCurrentGuides(currentGuides);
      } else {
        setCurrentGuides([]);
      }

      // Update canvas object position
      const updatedObjects = (props.canvasObjects || []).map((obj) =>
        obj.id === canvasObjectDragInfo.current!.id
          ? { ...obj, position: finalPosition }
          : obj,
      );
      props.onCanvasObjectsChange?.(updatedObjects);
    };

    const onUp = () => {
      // Handle endpoint drag end first (highest priority)
      if (endpointDragInfo.current) {
        // TODO: Check for node handle snapping here
        // For now, just clear the drag state
        endpointDragInfo.current = null;
        return;
      }

      // Handle canvas object drag end first (priority gate)
      if (canvasObjectDragInfo.current) {
        // If no movement occurred, treat as a click and use centralized click handler
        if (!canvasObjectDragInfo.current.hasMoved) {
          const objectId = canvasObjectDragInfo.current.id;
          const targetObject = (props.canvasObjects || []).find(
            (obj) => obj.id === objectId,
          );

          if (targetObject) {
            // Use centralized click handler with original event (preserves modifier keys)
            handleCanvasObjectClick(
              objectId,
              canvasObjectDragInfo.current.originalEvent,
            );
          }
        }

        // Only dispatch drag end event if there was substantial movement (similar to nodes)
        // Calculate movement distance to determine if this was a real drag
        if (canvasObjectDragInfo.current) {
          const currentObject = (props.canvasObjects || []).find(
            (obj) => obj.id === canvasObjectDragInfo.current!.id,
          );

          if (currentObject && canvasObjectDragInfo.current.hasMoved) {
            const distance = Math.sqrt(
              Math.pow(
                currentObject.position.x -
                  canvasObjectDragInfo.current.origin.x,
                2,
              ) +
                Math.pow(
                  currentObject.position.y -
                    canvasObjectDragInfo.current.origin.y,
                  2,
                ),
            );

            // Only dispatch if there was substantial movement (similar to dragThreshold)
            if (distance > dragThreshold) {
              justCompletedCanvasObjectDrag.current = true;
              cleanupManagerRef.current?.setTimeout(() => {
                justCompletedCanvasObjectDrag.current = false;
              }, 100);

              window.dispatchEvent(
                new CustomEvent("canvasObjectDragEnd", {
                  detail: { objectId: canvasObjectDragInfo.current.id },
                }),
              );
            }
          }
        }

        canvasObjectDragInfo.current = null;
        setCurrentGuides([]);
        return; // Exit early, don't process node drag end
      }

      // Handle node drag end only if no canvas object drag is active
      if (dragInfo.current) {
        const nodeId = dragInfo.current.id;
        
        // Cancel any pending RAF drag update
        if (dragRafId.current !== null) {
          cancelAnimationFrame(dragRafId.current);
          dragRafId.current = null;
        }
        
        // Apply any pending drag update immediately on release
        if (pendingDragUpdate.current) {
          const { dx, dy } = pendingDragUpdate.current;
          pendingDragUpdate.current = null;
          
          // Calculate final position
          const finalPosition = {
            x: dragInfo.current.origin.x + dx,
            y: dragInfo.current.origin.y + dy,
          };
          
          const updated = props.nodes.map((n) =>
            n.id === nodeId ? { ...n, position: finalPosition } : n,
          );
          props.onNodesChange(updated);
        }
        
        // Handle smart connect auto-connection on drag end
        if (
          !dragInfo.current.isGroupDrag &&
          props.proFeatures?.smartConnect?.enabled !== false
        ) {
          const finalPosition = props.nodes.find((n) => n.id === nodeId)?.position;
          if (finalPosition && enablePlugins) {
            const smartConnectPlugin = core.getPlugin("smart-connect-pro");
            if (smartConnectPlugin) {
              // Call the plugin's handleDragEnd method to execute auto-connection
              (smartConnectPlugin as any).handleDragEnd?.(
                nodeId,
                finalPosition,
              );
            }
          }
        }

        // Only set flag to prevent clicks if there was actual substantial movement (like canvas objects)
        // Calculate movement distance to determine if this was a real drag
        const finalPos = props.nodes.find(
          (n) => n.id === nodeId,
        )?.position;

        if (finalPos) {
          const distance = Math.sqrt(
            Math.pow(finalPos.x - dragInfo.current.origin.x, 2) +
              Math.pow(finalPos.y - dragInfo.current.origin.y, 2),
          );

          // Only set the flag if there was substantial movement (similar to dragThreshold)
          if (distance > dragThreshold) {
            justCompletedNodeDrag.current = true;
            cleanupManagerRef.current?.setTimeout(() => {
              justCompletedNodeDrag.current = false;
            }, 100);
          }
        }

        dragInfo.current = null;
        // Clear drag optimization - restore edges immediately, but delay placeholder restoration
        setSuppressEdgesDuringDrag(false);
        
        // PERFORMANCE: Delay placeholder-to-real-node swap to avoid immediate re-render thrash
        cleanupManagerRef.current?.setTimeout(() => {
          setDraggingNodeId(null);
        }, 75);
      }

      // Clear guides when drag ends (only for node drags, canvas object guides cleared above)
      setCurrentGuides([]);
    };

    const cleanupMove = cleanupManager.addEventListener(
      window,
      "mousemove",
      onMove,
    );
    const cleanupUp = cleanupManager.addEventListener(window, "mouseup", onUp);
    return () => {
      cleanupMove();
      cleanupUp();
    };
  }, [viewport, props]);

  // Keyboard event handling for deleting selected items (both nodes and canvas objects)
  useEffect(() => {
    const handleKeyDown = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      // Only handle delete/backspace keys
      if (keyboardEvent.key === "Delete" || keyboardEvent.key === "Backspace") {
        // Check if we're focused on an input field - if so, don't interfere
        const activeElement = document.activeElement as HTMLElement;
        if (
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable)
        ) {
          // Let the input handle the delete/backspace normally
          return;
        }

        // Security: Rate limit delete operations
        if (!actionRateLimiter.isAllowed("delete")) {
          console.warn("⚠️ Delete rate limit exceeded");
          setRateLimitWarning(true);
          setTimeout(() => setRateLimitWarning(false), 2000);
          return;
        }

        try {
          const selectedNodes = props.nodes.filter((node) => node.selected);
          const selectedObjects = (props.canvasObjects || []).filter(
            (obj) => obj.selected,
          );

          // If we have any selected items, prevent default and delete them
          if (selectedNodes.length > 0 || selectedObjects.length > 0) {
            keyboardEvent.preventDefault();

            // Save state before deletion for recovery
            saveState(props.nodes, props.edges, viewport);

            // Delete selected nodes with error handling
            if (selectedNodes.length > 0) {
              const updatedNodes = props.nodes.filter((node) => !node.selected);
              props.onNodesChange(updatedNodes);
            }

            // Delete selected canvas objects with error handling
            if (selectedObjects.length > 0) {
              const updatedObjects = (props.canvasObjects || []).filter(
                (obj) => !obj.selected,
              );
              props.onCanvasObjectsChange?.(updatedObjects);
            }

            // Log security event
            securityMonitor.recordEvent({
              type: "suspicious-activity",
              severity: "low",
              details: {
                action: "delete",
                deletedNodes: selectedNodes.length,
                deletedObjects: selectedObjects.length,
              },
              timestamp: Date.now(),
              blocked: false,
            });

          }
        } catch (error) {
          console.error("Failed to delete items:", error);
          handleError(error as Error, "delete-operation");
        }
      }
    };

    // Add event listener
    const cleanupKeydown = cleanupManager.addEventListener(
      document,
      "keydown",
      handleKeyDown,
    );

    // Cleanup
    return cleanupKeydown;
  }, [props.nodes, props.canvasObjects]);


  const worldStyle = {
    transform: `translate(${Math.round(viewport.x)}px, ${Math.round(viewport.y)}px) scale(${viewport.zoom})`,
  };

  // Canvas object click handler for selection
  const handleCanvasObjectClick = (objectId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Suppress clicks during or immediately after unified selection or node/canvas object drag
    if (
      selectionInProgress.current ||
      justCompletedUnifiedSelection.current ||
      justCompletedNodeDrag.current ||
      justCompletedCanvasObjectDrag.current
    ) {
      return;
    }

    // Check if this click is happening too close to a drag operation
    if (canvasObjectDragInfo.current) {
      const dragInfo = canvasObjectDragInfo.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const currentPos = clientToWorld(e.clientX, e.clientY, viewport, rect);
        const distance = Math.sqrt(
          Math.pow(currentPos.x - dragInfo.start.x, 2) +
            Math.pow(currentPos.y - dragInfo.start.y, 2),
        );

        // If we moved more than threshold, this is the end of a drag, not a click
        if (distance > dragThreshold) {
          canvasObjectDragInfo.current = null;
          return;
        }
      }
    }

    const targetObject = (props.canvasObjects || []).find(
      (obj) => obj.id === objectId,
    );
    if (!targetObject) return;

    let updatedObjects: CanvasObject[];

    if (e.shiftKey) {
      // Shift+Click: Toggle selection of this object without affecting node selections
      updatedObjects = (props.canvasObjects || []).map((canvasObject) =>
        canvasObject.id === objectId
          ? { ...canvasObject, selected: !canvasObject.selected }
          : canvasObject,
      );
    } else {
      // Regular click: Select only this object, deselect other canvas objects but preserve node selections
      updatedObjects = (props.canvasObjects || []).map((canvasObject) => ({
        ...canvasObject,
        selected: canvasObject.id === objectId,
      }));
    }

    props.onCanvasObjectsChange?.(updatedObjects);

    // Clear drag info after successful click
    if (canvasObjectDragInfo.current) {
      // Only dispatch drag end event if there was substantial movement (similar to nodes)
      if (canvasObjectDragInfo.current.hasMoved) {
        const distance = Math.sqrt(
          Math.pow(
            targetObject.position.x - canvasObjectDragInfo.current.origin.x,
            2,
          ) +
            Math.pow(
              targetObject.position.y - canvasObjectDragInfo.current.origin.y,
              2,
            ),
        );

        // Only dispatch if there was substantial movement (similar to dragThreshold)
        if (distance > dragThreshold) {
          justCompletedCanvasObjectDrag.current = true;
          cleanupManagerRef.current?.setTimeout(() => {
            justCompletedCanvasObjectDrag.current = false;
          }, 100);

          window.dispatchEvent(
            new CustomEvent("canvasObjectDragEnd", {
              detail: { objectId: canvasObjectDragInfo.current.id },
            }),
          );
        }
      }
      canvasObjectDragInfo.current = null;
    }

    // Call the external handler if provided
    if (props.onCanvasObjectClick) {
      props.onCanvasObjectClick(e, targetObject);
    }
  };

  // Get selected nodes count for screen reader announcements
  const selectedNodes = props.nodes.filter((n) => n.selected);
  const selectedObjects = (props.canvasObjects || []).filter(
    (obj) => obj.selected,
  );

  return (
    <>
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedNodes.length > 0 &&
          `${selectedNodes.length} node${selectedNodes.length > 1 ? "s" : ""} selected`}
        {selectedObjects.length > 0 &&
          `, ${selectedObjects.length} object${selectedObjects.length > 1 ? "s" : ""} selected`}
      </div>

      {/* Keyboard shortcuts help text for screen readers */}
      <div id="canvas-keyboard-shortcuts" className="sr-only">
        Keyboard shortcuts: Tab to navigate nodes, Enter to edit, Delete to
        remove, Control+C to copy, Control+V to paste, Control+Z to undo,
        Control+Y to redo, Arrow keys to move selected nodes, Plus/Minus to
        zoom.
      </div>

      <div
        ref={containerRef}
        className={`kiteframe-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${props.className || ""} ${panning ? "kiteframe-hand" : ""}`}
        style={{ touchAction: enableTouchGestures ? 'none' : 'auto' }}
        role="application"
        aria-label="Visual workflow canvas. Use arrow keys to navigate, Tab to select nodes, and Space to create connections."
        aria-describedby="canvas-keyboard-shortcuts"
        tabIndex={0}
        data-testid="workflow-canvas"
        onMouseDown={onBackgroundDown}
        onMouseMove={onBackgroundMove}
        onMouseUp={onBackgroundUp}
        onClick={(e) => {
          // Don't trigger canvas click if we just finished unified selection
          if (
            unifiedSelectStart.current ||
            unifiedSelectionRect ||
            justCompletedUnifiedSelection.current
          ) {
            return;
          }

          // Deselect all items when clicking background (both nodes and canvas objects)
          const hasSelectedNodes = props.nodes.some((node) => node.selected);
          const hasSelectedObjects =
            props.canvasObjects &&
            props.canvasObjects.some((obj) => obj.selected);

          if (hasSelectedNodes) {
            const updatedNodes = props.nodes.map((node) => ({
              ...node,
              selected: false,
            }));
            props.onNodesChange(updatedNodes);
          }

          if (hasSelectedObjects) {
            const updatedObjects = props.canvasObjects!.map((obj) => ({
              ...obj,
              selected: false,
            }));
            props.onCanvasObjectsChange?.(updatedObjects);
          }

          props.onCanvasClick?.();
        }}
      >
        <div className="kiteframe-world" style={worldStyle}>
          {/* Existing edges - edges connected to dragged node hidden during drag for performance */}
          <svg
            className="kiteframe-edge-layer"
            style={{
              position: "absolute",
              inset: "0",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <defs></defs>
            {(() => {
              // Recalculate edge z-indexes based on current node states
              const edgesWithZIndex = recalculateAllEdgeZIndexes(
                visibleEdges,
                props.nodes,
              );
              // Sort edges by z-index for proper rendering order
              const sortedEdges = sortEdgesByZIndex(edgesWithZIndex);

              return sortedEdges.map((e) => {
                // Skip edges connected to the dragged node during drag optimization
                if (suppressEdgesDuringDrag && draggingNodeId && 
                    (e.source === draggingNodeId || e.target === draggingNodeId)) {
                  return null;
                }
                
                const s = props.nodes.find((n) => n.id === e.source);
                const t = props.nodes.find((n) => n.id === e.target);
                if (!s || !t) return null;
                return (
                  <ConnectionEdge
                    key={e.id}
                    edge={e}
                    sourceNode={s}
                    targetNode={t}
                    onEdgeClick={(edge) => props.onEdgeClick?.(e as any, edge)}
                  />
                );
              });
            })()}

            {/* Edge reconnection handles for selected edges */}
            {(() => {
              // Use the same sorted edges for consistency
              const edgesWithZIndex = recalculateAllEdgeZIndexes(
                visibleEdges,
                props.nodes,
              );
              const sortedEdges = sortEdgesByZIndex(edgesWithZIndex);

              return sortedEdges.map((e) => {
                // Skip edge handles for edges connected to dragged node
                if (suppressEdgesDuringDrag && draggingNodeId && 
                    (e.source === draggingNodeId || e.target === draggingNodeId)) {
                  return null;
                }
                
                // Check if edge reconnection is enabled
                const edgeReconnectionConfig =
                  props.proFeatures?.edgeReconnection;
                const isReconnectionEnabled =
                  edgeReconnectionConfig?.enabled !== false; // Default enabled
                const isEdgeReconnectable =
                  e.reconnectable || edgeReconnectionConfig?.enableAllEdges;

                // Only show handles if edge is selected and reconnection is enabled
                if (
                  !e.selected ||
                  !isReconnectionEnabled ||
                  !isEdgeReconnectable
                )
                  return null;

                const s = props.nodes.find((n) => n.id === e.source);
                const t = props.nodes.find((n) => n.id === e.target);
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
              });
            })()}

            {/* ANIMATED PREVIEW EDGE while dragging a connection */}
            {connecting &&
              (() => {
                const src = props.nodes.find(
                  (n) => n.id === connecting.sourceId,
                );
                if (!src) return null;

                // Where to draw to: hovered node center (if exists) else cursor world position
                let tx = connecting.wx,
                  ty = connecting.wy;
                if (connecting.hoverTargetId) {
                  const tgt = props.nodes.find(
                    (n) => n.id === connecting.hoverTargetId,
                  );
                  if (tgt) {
                    const r = getNodeRect(tgt);
                    tx = r.cx;
                    ty = r.cy;
                  }
                }

                // Source anchor smart-positioned
                const anchor = sourceAnchorTowards(src, tx, ty);
                const sx = anchor.x,
                  sy = anchor.y;

                // Use animated connection preview
                return (
                  <AnimatedConnectionPreview
                    key="animated-preview"
                    x1={sx}
                    y1={sy}
                    x2={tx}
                    y2={ty}
                    isConnecting={true}
                    isValidTarget={
                      connecting.hoverTargetId !== null && connecting.eligible
                    }
                    isInvalidTarget={
                      connecting.hoverTargetId !== null && !connecting.eligible
                    }
                    config={{
                      duration: 600,
                      easing: "ease-out",
                      pulseOnConnection: true,
                      showParticles: true,
                      glowOnHover: true,
                      ...props.connectionAnimationConfig,
                    }}
                  />
                );
              })()}

            {/* SmartConnect Preview */}
            {props.connectionPreview &&
              (() => {
                const sourceNode = props.nodes.find(
                  (n) => n.id === props.connectionPreview!.source,
                );
                const targetNode = props.nodes.find(
                  (n) => n.id === props.connectionPreview!.target,
                );

                if (!sourceNode || !targetNode) return null;

                const sourceRect = getNodeRect(sourceNode);
                const targetRect = getNodeRect(targetNode);

                // Calculate anchor points
                const sourceAnchor = sourceAnchorTowards(
                  sourceNode,
                  targetRect.cx,
                  targetRect.cy,
                );
                const targetAnchor = sourceAnchorTowards(
                  targetNode,
                  sourceRect.cx,
                  sourceRect.cy,
                );

                return (
                  <line
                    key="smart-connect-preview"
                    x1={sourceAnchor.x}
                    y1={sourceAnchor.y}
                    x2={targetAnchor.x}
                    y2={targetAnchor.y}
                    stroke="#9ca3af"
                    strokeWidth="2"
                    strokeDasharray="8,4"
                    strokeLinecap="round"
                    opacity={0.6}
                    data-testid="smart-connect-ghost-preview"
                  />
                );
              })()}
          </svg>

          {/* Workflow Headers for each detected flow - only show if flow has 2+ nodes */}
          {flows.filter(flow => flow.nodes.length >= 2).map((flow, index) => {
            // Use workflow name from props, or generate a default name based on flow index
            const multiNodeFlows = flows.filter(f => f.nodes.length >= 2);
            const defaultName = multiNodeFlows.length > 1 
              ? `${props.workflowName || 'Workflow'} ${index + 1}` 
              : (props.workflowName || 'Workflow');
            const flowSettings = props.flowSettings?.[flow.id] || {
              name: defaultName,
              statusTrackingEnabled: false,
            };
            // Position header above the first node in the flow
            const firstNode = flow.nodes[0];
            const headerPosition = firstNode 
              ? { x: firstNode.position.x, y: firstNode.position.y }
              : { x: flow.boundingBox.x, y: flow.boundingBox.y };
            return (
              <WorkflowHeader
                key={`workflow-header-${flow.id}`}
                flowId={flow.id}
                flowNodes={flow.nodes}
                settings={flowSettings}
                position={headerPosition}
                scale={viewport.zoom}
                onSettingsChange={(flowId, settings) => {
                  props.onFlowSettingsChange?.(flowId, settings);
                }}
                onResetStatuses={(flowId) => {
                  props.onResetFlowStatuses?.(flowId);
                }}
                onThemeChange={(flowId) => {
                  props.onThemeChangeRequested?.(flowId, flow.nodes.map(n => n.id));
                }}
                onApplyTheme={(flowId, theme) => {
                  props.onApplyTheme?.(flowId, theme);
                }}
                onDeleteWorkflow={(flowId) => {
                  const nodeIds = flow.nodes.map(n => n.id);
                  props.onDeleteWorkflow?.(flowId, nodeIds);
                }}
                onDragWorkflow={(flowId, deltaX, deltaY, isDragStart) => {
                  const nodeIds = flow.nodes.map(n => n.id);
                  props.onDragWorkflow?.(flowId, nodeIds, deltaX, deltaY, isDragStart);
                }}
                onLayoutWorkflow={(flowId, layoutType) => {
                  const nodeIds = flow.nodes.map(n => n.id);
                  props.onLayoutWorkflow?.(flowId, nodeIds, layoutType);
                }}
                readOnly={false}
              />
            );
          })}

          {/* Nodes */}
          {visibleNodes
            .filter((n) => !n.hidden)
            .map((n) => {
              // Determine if status tracking is enabled for this node's flow
              // Status tracking applies to all default workflow nodes (input, process, condition, output)
              const nodeFlowId = nodeToFlowIdMap.get(n.id);
              const defaultNodeTypes = ['input', 'process', 'condition', 'output'];
              const isDefaultNode = defaultNodeTypes.includes(n.type || '');
              const isStatusEnabled = nodeFlowId && isDefaultNode
                ? props.flowSettings?.[nodeFlowId]?.statusTrackingEnabled ?? false 
                : false;
              
              const w = n.style?.width ?? n.width ?? 200;
              // Check if node should auto-resize height based on content
              // Auto-height is enabled by default, unless explicitly disabled or node has fixed height
              const hasExplicitHeight = n.style?.height !== undefined || 
                (n.type === "image" && n.data?.src && n.height !== undefined);
              const autoHeight = n.data?.autoHeight !== false && !hasExplicitHeight;
              
              // Calculate minimum height (the default node height)
              const minHeight = 100;
              
              // Use dynamic height calculation for fixed-height nodes
              const dynamicHeight = calculateNodeHeight(n, w);
              const explicitHeight =
                n.style?.height ??
                (n.type === "image" && n.data?.src ? n.height : undefined);
              const h = autoHeight 
                ? minHeight  // Auto-height uses min-height, content determines actual height
                : (explicitHeight ?? Math.max(dynamicHeight, n.height ?? minHeight));
              // Enhanced color system with separate header/body colors
              const colors = n.data?.colors || {};
              const headerBg =
                colors.headerBackground || n.data?.color || "#f8fafc";
              // Body color: use explicit color, or derive 10% tint from header
              const bodyBg = colors.bodyBackground || getTintedBodyColor(headerBg, 0.1);
              const border =
                colors.borderColor || n.data?.borderColor || "#e2e8f0";
              // Auto-contrast: use explicit color if set, otherwise calculate based on background
              const headerText =
                colors.headerTextColor ||
                colors.textColor ||
                n.data?.textColor ||
                getContrastTextColor(headerBg);
              const bodyText =
                colors.bodyTextColor ||
                colors.textColor ||
                n.data?.textColor ||
                getContrastTextColor(bodyBg);

              // Helper function to add reactions to nodes
              const addReaction = (nodeId: string, emoji: string) => {
                const updatedNodes = props.nodes.map((node) => {
                  if (node.id === nodeId) {
                    const reactions = node.data?.reactions || {};
                    const reaction = reactions[emoji] || {
                      count: 0,
                      userIds: [],
                    };
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        reactions: {
                          ...reactions,
                          [emoji]: {
                            count: reaction.count + 1,
                            userIds: [
                              ...reaction.userIds,
                              props.currentUserId || "current-user",
                            ],
                          },
                        },
                      },
                    };
                  }
                  return node;
                });
                props.onNodesChange?.(updatedNodes);
              };

              const removeReaction = (nodeId: string, emoji: string) => {
                const updatedNodes = props.nodes.map((node) => {
                  if (node.id === nodeId) {
                    const reactions = node.data?.reactions || {};
                    const reaction = reactions[emoji];
                    if (reaction) {
                      const newUserIds = reaction.userIds.filter(
                        (id: string) =>
                          id !== (props.currentUserId || "current-user"),
                      );
                      const newCount = Math.max(0, reaction.count - 1);
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          reactions: {
                            ...reactions,
                            [emoji]: {
                              count: newCount,
                              userIds: newUserIds,
                            },
                          },
                        },
                      };
                    }
                  }
                  return node;
                });
                props.onNodesChange?.(updatedNodes);
              };

              // Render new node types using their specialized components
              if (n.type === "text") {
                return (
                  <TextNode
                    key={n.id}
                    node={n}
                    onUpdate={(updates) => {
                      const updated = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onResize={(width, height) => {
                      const updated = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, style: { ...node.style, width, height } }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onAddReaction={addReaction}
                    onRemoveReaction={removeReaction}
                  />
                );
              }

              if (n.type === "sticky") {
                return (
                  <StickyNote
                    key={n.id}
                    node={n}
                    onUpdate={(updates) => {
                      const updated = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onResize={(width, height) => {
                      const updated = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, style: { ...node.style, width, height } }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onDelete={() => {
                      const updated = props.nodes.filter(
                        (node) => node.id !== n.id,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onAddReaction={addReaction}
                    onRemoveReaction={removeReaction}
                  />
                );
              }

              if (n.type === "shape") {
                return (
                  <ShapeNode
                    key={n.id}
                    node={n}
                    onUpdate={(updates) => {
                      const updated = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onResize={(width, height) => {
                      const updated = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, style: { ...node.style, width, height } }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onAddReaction={addReaction}
                    onRemoveReaction={removeReaction}
                  />
                );
              }

              // Handle image nodes with proper ImageNode component
              if (n.type === "image") {
                return (
                  <ImageNode
                    key={n.id}
                    node={n as any} // Type assertion for compatibility
                    onUpdate={(nodeId: string, updates: any) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId ? { ...node, ...updates } : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onFocusNode={props.onFocusNode}
                    onImageUpload={async (nodeId: string, file: File) => {
                      // Convert File to data URL for compatibility with existing system
                      return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = reader.result as string;
                          props.onImageUpload?.(nodeId, dataUrl);
                          resolve(dataUrl);
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                    onImageUrlSet={(nodeId: string, url: string) => {
                      props.onImageUrlSet?.(nodeId, url);
                    }}
                    onDoubleClick={(e) => props.onNodeDoubleClick?.(e, n)}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    onStartDrag={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );

                      // Check if this node is selected and if there are other selected nodes or canvas objects
                      const selectedNodes = props.nodes.filter(
                        (node) => node.selected === true,
                      );
                      const selectedCanvasObjects = (
                        props.canvasObjects || []
                      ).filter((obj) => obj.selected === true);
                      const totalSelected =
                        selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag =
                        totalSelected > 1 && n.selected === true;

                      // Prepare origins for all nodes that will be dragged
                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({
                            id: node.id,
                            origin: { ...node.position },
                          }))
                        : [{ id: n.id, origin: { ...n.position } }];

                      // Prepare origins for all canvas objects that will be dragged
                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({
                            id: obj.id,
                            origin: { ...obj.position },
                          }))
                        : [];

                      dragInfo.current = {
                        id: n.id,
                        start: wp,
                        origin: { ...n.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                      // Note: drag optimization activates after 100px threshold in handleNodeDragMove
                    }}
                    onClick={(e: React.MouseEvent) => {
                      props.onNodeClick?.(e, n);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                    style={{
                      position: "absolute",
                      left: n.position.x,
                      top: n.position.y,
                      zIndex: n.zIndex || 0,
                    }}
                    className={n.selected ? "selected" : ""}
                  />
                );
              }

              // Handle webview nodes
              if (n.type === "webview") {
                return (
                  <WebviewNode
                    key={n.id}
                    node={n as any}
                    onUpdate={(nodeId: string, updates: any) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId ? { ...node, ...updates } : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onFocusNode={props.onFocusNode}
                    onDoubleClick={(e) => props.onNodeDoubleClick?.(e, n)}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    onStartDrag={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );

                      const selectedNodes = props.nodes.filter(
                        (node) => node.selected === true,
                      );
                      const selectedCanvasObjects = (
                        props.canvasObjects || []
                      ).filter((obj) => obj.selected === true);
                      const totalSelected =
                        selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag =
                        totalSelected > 1 && n.selected === true;

                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({
                            id: node.id,
                            origin: { ...node.position },
                          }))
                        : [{ id: n.id, origin: { ...n.position } }];

                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({
                            id: obj.id,
                            origin: { ...obj.position },
                          }))
                        : [];

                      dragInfo.current = {
                        id: n.id,
                        start: wp,
                        origin: { ...n.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                    }}
                    onClick={(e: React.MouseEvent) => {
                      props.onNodeClick?.(e, n);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                    onConvertToLink={(nodeId: string, url: string, title: string) => {
                      const webviewNode = props.nodes.find((node) => node.id === nodeId);
                      if (!webviewNode) return;
                      
                      const originalWidth = webviewNode.style?.width || webviewNode.width || 280;
                      const originalHeight = webviewNode.style?.height || webviewNode.height || 140;
                      const originalColors = webviewNode.data?.colors || {};
                      
                      const newNode: Node = {
                        id: nodeId,
                        type: 'process',
                        position: { ...webviewNode.position },
                        data: {
                          label: title || webviewNode.data?.title || 'Link',
                          description: webviewNode.data?.description || '',
                          hyperlinks: [{
                            id: `link-${Date.now()}`,
                            text: url,
                            url: url,
                            showPreview: true,
                          }],
                          colors: {
                            headerBackground: originalColors.headerBackground || '#06b6d4',
                            bodyBackground: originalColors.bodyBackground || '#ffffff',
                            headerTextColor: originalColors.headerTextColor || '#ffffff',
                            bodyTextColor: originalColors.bodyTextColor,
                            borderColor: originalColors.borderColor,
                          },
                          reactions: webviewNode.data?.reactions,
                        },
                        style: { width: originalWidth, height: Math.min(originalHeight, 200) },
                        selected: true,
                        zIndex: webviewNode.zIndex || 0,
                        draggable: webviewNode.draggable,
                        selectable: webviewNode.selectable,
                      };
                      
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId ? newNode : node
                      );
                      props.onNodesChange?.(updated);
                    }}
                    style={{
                      position: "absolute",
                      left: n.position.x,
                      top: n.position.y,
                      zIndex: n.zIndex || 0,
                    }}
                    className={n.selected ? "selected" : ""}
                  />
                );
              }

              // Handle table nodes
              if (n.type === "table") {
                const tableId = n.data?.tableId;
                const tableFromProps = tableId ? props.tableData?.[tableId] : undefined;
                
                // Merge table data from props into node.data for the component
                const nodeWithTable = tableFromProps ? {
                  ...n,
                  data: { ...n.data, table: tableFromProps }
                } : n;
                
                return (
                  <TableNode
                    key={n.id}
                    node={nodeWithTable as any}
                    onUpdateTable={(tid: string, table: import('../types').DataTable) => {
                      // Persist table data changes to the workflow
                      props.onTableDataChange?.(tid, table);
                    }}
                    onCreateNodeFromRow={(tid: string, row: Record<string, unknown>, rowIndex: number) => {
                      // Create a new node from the row data
                      props.onCreateNodeFromRow?.(tid, row, rowIndex);
                    }}
                    onUpdate={(nodeId: string, updates: Partial<Node>) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId
                          ? { ...node, ...updates }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onFocusNode={props.onFocusNode}
                    onStartDrag={(e: React.MouseEvent, draggedNode: Node) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );

                      // Check if this node is selected and if there are other selected nodes or canvas objects
                      const selectedNodes = props.nodes.filter(
                        (node) => node.selected === true,
                      );
                      const selectedCanvasObjects = (
                        props.canvasObjects || []
                      ).filter((obj) => obj.selected === true);
                      const totalSelected =
                        selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag =
                        totalSelected > 1 && draggedNode.selected === true;

                      // Prepare origins for all nodes that will be dragged
                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({
                            id: node.id,
                            origin: { ...node.position },
                          }))
                        : [{ id: draggedNode.id, origin: { ...draggedNode.position } }];

                      // Prepare origins for all canvas objects that will be dragged
                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({
                            id: obj.id,
                            origin: { ...obj.position },
                          }))
                        : [];

                      dragInfo.current = {
                        id: draggedNode.id,
                        start: wp,
                        origin: { ...draggedNode.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                      // Note: drag optimization activates after 100px threshold in handleNodeDragMove
                    }}
                    onClick={(e: React.MouseEvent, clickedNode: Node) => {
                      props.onNodeClick?.(e, clickedNode);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                    savedTemplates={props.savedTemplates}
                    onGenerateFromTemplate={props.onGenerateFromTemplate}
                    isStatusEnabled={isStatusEnabled}
                    style={{
                      position: "absolute",
                      left: n.position.x,
                      top: n.position.y,
                      zIndex: n.zIndex || 0,
                    }}
                    className={n.selected ? "selected" : ""}
                  />
                );
              }

              // Handle form nodes
              if (n.type === "form") {
                return (
                  <FormNode
                    key={n.id}
                    node={n as any}
                    onUpdate={(nodeId: string, updates: Partial<Node>) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId
                          ? { ...node, ...updates }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onFocusNode={props.onFocusNode}
                    onStartDrag={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );

                      const selectedNodes = props.nodes.filter(
                        (node) => node.selected === true,
                      );
                      const selectedCanvasObjects = (
                        props.canvasObjects || []
                      ).filter((obj) => obj.selected === true);
                      const totalSelected =
                        selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag =
                        totalSelected > 1 && n.selected === true;

                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({
                            id: node.id,
                            origin: { ...node.position },
                          }))
                        : [{ id: n.id, origin: { ...n.position } }];

                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({
                            id: obj.id,
                            origin: { ...obj.position },
                          }))
                        : [];

                      dragInfo.current = {
                        id: n.id,
                        start: wp,
                        origin: { ...n.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                      // Note: drag optimization activates after 100px threshold in handleNodeDragMove
                    }}
                    onClick={(e: React.MouseEvent) => {
                      props.onNodeClick?.(e, n);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                    tables={Object.values(props.tableData || {})}
                    onOpenDataLinkPicker={(fieldId, currentLink) => {
                      setDataLinkPicker({
                        isOpen: true,
                        formNodeId: n.id,
                        fieldId,
                        currentLink,
                      });
                    }}
                    onLinkTable={props.onFormLinkTable}
                    onUnlinkTable={props.onFormUnlinkTable}
                    onUpdateTableCell={props.onUpdateTableCell}
                    isStatusEnabled={isStatusEnabled}
                    style={{
                      position: "absolute",
                      left: n.position.x,
                      top: n.position.y,
                      zIndex: n.zIndex || 0,
                    }}
                    className={n.selected ? "selected" : ""}
                  />
                );
              }

              // Handle compound nodes
              if (n.type === "compound") {
                return (
                  <CompoundNode
                    key={n.id}
                    node={n as any}
                    onUpdate={(nodeId: string, updates: Partial<Node>) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId
                          ? { ...node, ...updates }
                          : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onFocusNode={props.onFocusNode}
                    onStartDrag={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );

                      const selectedNodes = props.nodes.filter(
                        (node) => node.selected === true,
                      );
                      const selectedCanvasObjects = (
                        props.canvasObjects || []
                      ).filter((obj) => obj.selected === true);
                      const totalSelected =
                        selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag =
                        totalSelected > 1 && n.selected === true;

                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({
                            id: node.id,
                            origin: { ...node.position },
                          }))
                        : [{ id: n.id, origin: { ...n.position } }];

                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({
                            id: obj.id,
                            origin: { ...obj.position },
                          }))
                        : [];

                      dragInfo.current = {
                        id: n.id,
                        start: wp,
                        origin: { ...n.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                      // Note: drag optimization activates after 100px threshold in handleNodeDragMove
                    }}
                    onClick={(e: React.MouseEvent) => {
                      props.onNodeClick?.(e, n);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                    onImageUpload={async (nodeId: string, file: File) => {
                      return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = reader.result as string;
                          props.onImageUpload?.(nodeId, dataUrl);
                          resolve(dataUrl);
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                    tables={props.tableData ? Object.entries(props.tableData).map(([tableId, table]) => {
                      const tableNode = props.nodes.find(node => 
                        node.type === 'table' && node.data?.tableId === tableId
                      );
                      return {
                        nodeId: tableNode?.id || tableId,
                        tableId,
                        tableName: table.name || 'Table',
                        table,
                      };
                    }) : []}
                    onSaveAsTemplate={props.onSaveAsTemplate}
                    isStatusEnabled={isStatusEnabled}
                    style={{
                      position: "absolute",
                      left: n.position.x,
                      top: n.position.y,
                      zIndex: n.zIndex || 0,
                    }}
                    className={n.selected ? "selected" : ""}
                  />
                );
              }

              // Handle code nodes
              if (n.type === "code") {
                // Check both edge directions: edges where code node is target OR source
                // Only include edges connected to table or form nodes (exclude render nodes, etc.)
                const connectedDataSources = props.edges
                  ?.filter((edge) => edge.target === n.id || edge.source === n.id)
                  .map((edge) => {
                    // Determine which end is the data source (form/table)
                    const isCodeTarget = edge.target === n.id;
                    const dataNodeId = isCodeTarget ? edge.source : edge.target;
                    const dataNode = props.nodes.find((node) => node.id === dataNodeId);
                    if (!dataNode) return null;
                    // Only process form or table nodes - skip render, code, and other node types
                    if (dataNode.type !== 'form' && dataNode.type !== 'table') return null;
                    if (dataNode.type === 'form') {
                      const formData: Record<string, unknown> = {};
                      dataNode.data?.fields?.forEach((field: any) => {
                        formData[field.label || field.id] = field.value;
                      });
                      const formName = dataNode.data?.label || 'Form';
                      const variableName = edge.data?.variableName;
                      return { nodeId: dataNode.id, nodeType: 'form' as const, nodeName: formName, variableName: variableName, data: formData };
                    }
                    if (dataNode.type === 'table') {
                      const tableId = dataNode.data?.tableId;
                      const table = tableId ? props.tableData?.[tableId] : null;
                      const tableName = dataNode.data?.label || 'Table';
                      const variableName = edge.data?.variableName || tableName.toLowerCase().replace(/\s+/g, '_');
                      if (table) {
                        const columnNames = (table.columns?.map((col: any) => typeof col === 'string' ? col : col.name || col.id) || []).filter((name: any): name is string => typeof name === 'string' && name.length > 0);
                        return { 
                          nodeId: dataNode.id, 
                          nodeType: 'table' as const, 
                          nodeName: tableName,
                          variableName: variableName,
                          data: { [variableName]: table.rows, _columns: columnNames } 
                        };
                      }
                      return { 
                        nodeId: dataNode.id, 
                        nodeType: 'table' as const, 
                        nodeName: tableName,
                        variableName: variableName,
                        data: { [variableName]: [], _columns: [], _pending: true } 
                      };
                    }
                    return null;
                  })
                  .filter(Boolean) as Array<{ nodeId: string; nodeType: 'form' | 'table'; nodeName?: string; variableName?: string; data: Record<string, unknown> }>;

                return (
                  <CodeNodeComponent
                    key={n.id}
                    node={n as any}
                    connectedDataSources={connectedDataSources}
                    onUpdate={(nodeId: string, updates: any) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId ? { ...node, ...updates } : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onCreateRenderNode={(codeNodeId: string) => {
                      const codeNode = props.nodes.find((node) => node.id === codeNodeId);
                      if (!codeNode) return;
                      const existingRenderEdge = props.edges?.find(
                        (edge) => edge.source === codeNodeId && 
                        props.nodes.find((node) => node.id === edge.target)?.type === 'render'
                      );
                      if (existingRenderEdge) {
                        const renderNode = props.nodes.find((node) => node.id === existingRenderEdge.target);
                        if (renderNode) {
                          props.onFocusNode?.(renderNode.id);
                        }
                        return;
                      }
                      const renderNodeId = generateNodeId();
                      const codeNodeWidth = codeNode.style?.width || codeNode.width || 400;
                      const initialHtmlContent = codeNode.data?.lastResult?.htmlOutput || codeNode.data?.lastResult?.output || '';
                      const renderNode = createRenderNode(
                        renderNodeId,
                        { x: codeNode.position.x + codeNodeWidth + 50, y: codeNode.position.y },
                        { label: 'HTML Output', sourceNodeId: codeNodeId, htmlContent: initialHtmlContent }
                      );
                      props.onNodesChange?.([...props.nodes, renderNode]);
                      props.onConnect?.({ source: codeNodeId, target: renderNodeId });
                    }}
                    onFocusNode={props.onFocusNode}
                    onDoubleClick={(e) => props.onNodeDoubleClick?.(e, n)}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    onStartDrag={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );

                      const selectedNodes = props.nodes.filter(
                        (node) => node.selected === true,
                      );
                      const selectedCanvasObjects = (
                        props.canvasObjects || []
                      ).filter((obj) => obj.selected === true);
                      const totalSelected =
                        selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag =
                        totalSelected > 1 && n.selected === true;

                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({
                            id: node.id,
                            origin: { ...node.position },
                          }))
                        : [{ id: n.id, origin: { ...n.position } }];

                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({
                            id: obj.id,
                            origin: { ...obj.position },
                          }))
                        : [];

                      dragInfo.current = {
                        id: n.id,
                        start: wp,
                        origin: { ...n.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                    }}
                    onClick={(e: React.MouseEvent) => {
                      props.onNodeClick?.(e, n);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(
                        e.clientX,
                        e.clientY,
                        viewport,
                        rect,
                      );
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                    isStatusEnabled={isStatusEnabled}
                    style={{
                      position: "absolute",
                      left: n.position.x,
                      top: n.position.y,
                      zIndex: n.zIndex || 0,
                    }}
                    className={n.selected ? "selected" : ""}
                  />
                );
              }

              if (n.type === "render") {
                const sourceEdge = props.edges?.find((edge) => edge.target === n.id);
                const sourceNode = sourceEdge ? props.nodes.find((node) => node.id === sourceEdge.source) : null;
                const htmlContent = sourceNode?.type === 'code' && sourceNode.data?.lastResult?.htmlOutput
                  ? sourceNode.data.lastResult.htmlOutput
                  : n.data?.htmlContent || '';

                return (
                  <RenderNodeComponent
                    key={n.id}
                    node={{ ...n, data: { ...n.data, htmlContent, sourceNodeId: sourceNode?.id } } as any}
                    onUpdate={(nodeId: string, updates: any) => {
                      const updated = props.nodes.map((node) =>
                        node.id === nodeId ? { ...node, ...updates } : node,
                      );
                      props.onNodesChange?.(updated);
                    }}
                    onFocusNode={props.onFocusNode}
                    onDoubleClick={(e) => props.onNodeDoubleClick?.(e, n)}
                    showHandles={!props.readOnly && n.showHandles !== false}
                    showResizeHandle={n.resizable !== false}
                    onStartDrag={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);

                      const selectedNodes = props.nodes.filter((node) => node.selected === true);
                      const selectedCanvasObjects = (props.canvasObjects || []).filter((obj) => obj.selected === true);
                      const totalSelected = selectedNodes.length + selectedCanvasObjects.length;
                      const isGroupDrag = totalSelected > 1 && n.selected === true;

                      const origins = isGroupDrag
                        ? selectedNodes.map((node) => ({ id: node.id, origin: { ...node.position } }))
                        : [{ id: n.id, origin: { ...n.position } }];

                      const canvasObjectOrigins = isGroupDrag
                        ? selectedCanvasObjects.map((obj) => ({ id: obj.id, origin: { ...obj.position } }))
                        : [];

                      dragInfo.current = {
                        id: n.id,
                        start: wp,
                        origin: { ...n.position },
                        origins: origins,
                        canvasObjectOrigins: canvasObjectOrigins,
                        isGroupDrag: isGroupDrag,
                      };
                    }}
                    onClick={(e: React.MouseEvent) => {
                      props.onNodeClick?.(e, n);
                    }}
                    onHandleConnect={(position, e) => {
                      if (!containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
                      setConnecting({
                        sourceId: n.id,
                        wx: wp.x,
                        wy: wp.y,
                        hoverTargetId: null,
                        eligible: false,
                      });
                    }}
                    viewport={viewport}
                    showDragPlaceholder={draggingNodeId === n.id}
                    isAnyDragActive={!!draggingNodeId}
                  />
                );
              }

              // Check for plugin renderers before falling back to default rendering
              if (enablePlugins && n.type) {
                const hooks = core.getHooks();
                const PluginRenderer = hooks.nodeRenderers?.[n.type];

                if (PluginRenderer) {
                  return (
                    <PluginRenderer
                      key={n.id}
                      node={n}
                      onUpdate={(nodeId: string, updates: any) => {
                        const updated = props.nodes.map((node) =>
                          node.id === nodeId ? { ...node, ...updates } : node,
                        );
                        props.onNodesChange?.(updated);
                      }}
                      onConnect={(sourceId: string, targetId: string) => {
                        // Handle connection logic
                      }}
                      onDoubleClick={(e: React.MouseEvent) =>
                        props.onNodeDoubleClick?.(e, n)
                      }
                      onFocusNode={props.onFocusNode}
                      onStartDrag={(e: React.MouseEvent, node: any) => {
                        e.stopPropagation();
                        if (!containerRef.current) return;
                        const rect =
                          containerRef.current.getBoundingClientRect();
                        const wp = clientToWorld(
                          e.clientX,
                          e.clientY,
                          viewport,
                          rect,
                        );

                        // Check if this node is selected and if there are other selected nodes or canvas objects
                        const selectedNodes = props.nodes.filter(
                          (node) => node.selected === true,
                        );
                        const selectedCanvasObjects = (
                          props.canvasObjects || []
                        ).filter((obj) => obj.selected === true);
                        const totalSelected =
                          selectedNodes.length + selectedCanvasObjects.length;
                        const isGroupDrag =
                          totalSelected > 1 && n.selected === true;

                        // Prepare origins for all nodes that will be dragged
                        const origins = isGroupDrag
                          ? selectedNodes.map((node) => ({
                              id: node.id,
                              origin: { ...node.position },
                            }))
                          : [{ id: n.id, origin: { ...n.position } }];

                        dragInfo.current = {
                          id: n.id,
                          start: wp,
                          origin: { ...n.position },
                          isGroupDrag,
                          origins,
                        };
                      }}
                      viewport={viewport}
                      onImageUpload={props.onImageUpload}
                      onImageUrlSet={props.onImageUrlSet}
                    />
                  );
                }
              }

              // Fallback to default rendering for unregistered node types
              // Check if border should be hidden
              const hasNoBorder = n.data?.noStroke === true;
              const borderStyleValue = n.data?.borderStyle || 'solid';
              // Use consistent border radius - container should match header/body corners
              // When using 2px border, the inner content radius should be slightly smaller
              const cornerRadius = 10; // Match the visual appearance
              
              return (
                <div
                  key={n.id}
                  ref={(el) => registerNodeRef(n.id, el)}
                  data-node-id={n.id}
                  className={`kiteframe-node group ${n.selected ? "selected" : ""}`}
                  style={{
                    left: n.position.x,
                    top: n.position.y,
                    width: w,
                    // Auto-height: use minHeight and let content expand; fixed height: use fixed h
                    ...(autoHeight 
                      ? { minHeight: h, height: 'auto' } 
                      : { height: h }),
                    // Use real CSS border (like StickyNoteObject) instead of box-shadow
                    borderWidth: hasNoBorder ? '0px' : '2px',
                    borderStyle: hasNoBorder ? 'none' : borderStyleValue,
                    borderColor: hasNoBorder ? 'transparent' : border,
                    borderRadius: `${cornerRadius}px`,
                    // Selection indicator using box-shadow to respect border-radius
                    boxShadow: n.selected ? '0 0 0 2px #3b82f6' : 'none',
                    background: "transparent", // Remove default background since we'll use separate header/body
                    display: "flex",
                    flexDirection: "column",
                    zIndex: n.zIndex || 0,
                    boxSizing: 'border-box',
                    overflow: 'visible', // Allow edge handles and hover menus to extend beyond node bounds
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // Don't start drag when inline editing is active on this node
                    if (props.inlineEditing?.nodeId === n.id) {
                      return;
                    }
                    if (!containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    const wp = clientToWorld(
                      e.clientX,
                      e.clientY,
                      viewport,
                      rect,
                    );

                    // Check if this node is selected and if there are other selected nodes or canvas objects
                    const selectedNodes = props.nodes.filter(
                      (node) => node.selected === true,
                    );
                    const selectedCanvasObjects = (
                      props.canvasObjects || []
                    ).filter((obj) => obj.selected === true);
                    const totalSelected =
                      selectedNodes.length + selectedCanvasObjects.length;
                    const isGroupDrag =
                      totalSelected > 1 && n.selected === true;

                    // Prepare origins for all nodes that will be dragged
                    const origins = isGroupDrag
                      ? selectedNodes.map((node) => ({
                          id: node.id,
                          origin: { ...node.position },
                        }))
                      : [{ id: n.id, origin: { ...n.position } }];

                    // Prepare origins for all canvas objects that will be dragged
                    const canvasObjectOrigins = isGroupDrag
                      ? selectedCanvasObjects.map((obj) => ({
                          id: obj.id,
                          origin: { ...obj.position },
                        }))
                      : [];

                    dragInfo.current = {
                      id: n.id,
                      start: wp,
                      origin: { ...n.position },
                      origins: origins,
                      canvasObjectOrigins: canvasObjectOrigins,
                      isGroupDrag: isGroupDrag,
                    };

                    // Notify SmartConnectPlugin of drag start (for both single and group drags)
                    if (
                      enablePlugins &&
                      props.proFeatures?.smartConnect?.enabled !== false
                    ) {
                      const smartConnectPlugin =
                        core.getPlugin("smart-connect-pro");
                      if (smartConnectPlugin) {
                        // Call the plugin's handleDragStart method to initialize drag tracking
                        (smartConnectPlugin as any).handleDragStart?.(n.id, wp);
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    props.onNodeRightClick?.(e, n);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();

                    // Suppress clicks during or immediately after unified selection or node drag
                    if (
                      selectionInProgress.current ||
                      justCompletedUnifiedSelection.current ||
                      justCompletedNodeDrag.current
                    ) {
                      return;
                    }

                    if (e.shiftKey) {
                      // Shift+Click: Toggle selection of this node without affecting canvas objects
                      const updatedNodes = props.nodes.map((node) =>
                        node.id === n.id
                          ? { ...node, selected: !node.selected }
                          : node,
                      );
                      props.onNodesChange(updatedNodes);
                    } else {
                      // Regular click: Select only this node, deselect other nodes but preserve canvas object selections
                      const updatedNodes = props.nodes.map((node) => ({
                        ...node,
                        selected: node.id === n.id,
                      }));
                      props.onNodesChange(updatedNodes);
                    }

                    props.onNodeClick?.(e, n);
                  }}
                >
                  {!n.data?.hideHeader && (
                    <div
                      className="title"
                      style={{
                        backgroundColor: headerBg,
                        color: headerText,
                        borderBottom: `1px solid ${border}`,
                        cursor: props.inlineEditing?.nodeId === n.id && props.inlineEditing?.part === 'header' ? 'text' : 'grab',
                        overflow: 'hidden',
                        borderRadius: n.data?.hideDescription 
                          ? `${cornerRadius - 2}px` // All corners if no body
                          : `${cornerRadius - 2}px ${cornerRadius - 2}px 0 0`, // Top corners only
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        props.onNodeDoubleClick?.(e, n, 'header');
                      }}
                    >
                      {props.inlineEditing?.nodeId === n.id && props.inlineEditing?.part === 'header' ? (
                        <InlineTextEditor
                          initialValue={n.data?.label || ''}
                          placeholder="Enter label..."
                          onSave={(value) => props.onInlineEditingSave?.(n.id, 'header', value)}
                          onCancel={() => props.onInlineEditingCancel?.()}
                          color={headerText}
                          fontSize={n.data?.headerFontSize || 12}
                          fontWeight={n.data?.headerBold ? 700 : 600}
                          textAlign={n.data?.headerTextAlign || 'left'}
                          autoFocus
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: n.data?.headerFontSize ? `${n.data.headerFontSize}px` : '12px',
                            fontWeight: n.data?.headerBold ? 700 : 600,
                            fontStyle: n.data?.headerItalic ? 'italic' : 'normal',
                            textDecoration: [
                              n.data?.headerUnderline ? 'underline' : '',
                              n.data?.headerStrikethrough ? 'line-through' : ''
                            ].filter(Boolean).join(' ') || 'none',
                            textAlign: n.data?.headerTextAlign || 'left',
                            display: 'block',
                            width: '100%',
                          }}
                        >
                          {n.data?.label || n.type || n.id}
                        </span>
                      )}
                    </div>
                  )}
                  {!n.data?.hideDescription && (
                    <div
                      className="body"
                      style={{
                        backgroundColor: bodyBg,
                        color: bodyText,
                        padding: n.type === "image" ? "0" : "8px 12px",
                        flex: 1, // Always use flex:1 to fill remaining space
                        minHeight: autoHeight ? 48 : undefined, // Minimum body height for auto-height nodes
                        display: "flex",
                        flexDirection: n.type === "image" ? "column" : "row", // Row layout for icon+text
                        // For auto-height, align items to top so text starts at top of body area
                        // For fixed height, center items vertically
                        alignItems: autoHeight && n.type !== "image" ? "flex-start" : "center",
                        gap: n.type === "image" ? undefined : "10px",
                        height:
                          n.type === "image"
                            ? `${n.data?.hideHeader ? h : h - 30}px`
                            : undefined, // Account for title height
                        justifyContent:
                          n.type === "image" ? "center" : undefined,
                        cursor: n.type !== "image" 
                          ? (props.inlineEditing?.nodeId === n.id && props.inlineEditing?.part === 'body' ? 'text' : 'grab')
                          : undefined,
                        overflow: (props.inlineEditing?.nodeId === n.id && props.inlineEditing?.part === 'body') || autoHeight ? 'visible' : 'hidden',
                        borderRadius: (() => {
                          const hasHeader = !n.data?.hideHeader;
                          const hasHyperlinks = normalizeHyperlinks(n.data).length > 0;
                          if (!hasHeader && !hasHyperlinks) return `${cornerRadius - 2}px`; // All corners
                          if (!hasHeader && hasHyperlinks) return `${cornerRadius - 2}px ${cornerRadius - 2}px 0 0`; // Top only
                          if (hasHeader && !hasHyperlinks) return `0 0 ${cornerRadius - 2}px ${cornerRadius - 2}px`; // Bottom only
                          return '0'; // No corners (header has top, footer has bottom)
                        })(),
                      }}
                      onDoubleClick={(e) => {
                        if (n.type !== "image") {
                          e.stopPropagation();
                          e.preventDefault();
                          props.onNodeDoubleClick?.(e, n, 'body');
                        }
                      }}
                    >
                      {/* Icon/Emoji display - side by side with text */}
                      {n.data?.iconVisible !== false && n.data?.nodeIcon && n.type !== "image" && (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            minWidth: "40px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            backgroundColor: `${headerBg}80`,
                            flexShrink: 0,
                          }}
                          data-testid={`node-icon-${n.id}`}
                        >
                          {n.data.nodeIcon}
                        </div>
                      )}
                      {n.type === "image" ? (
                        n.data?.src ? (
                          <img
                            src={n.data.src}
                            alt=""
                            style={
                              {
                                maxWidth: "100%",
                                maxHeight: "100%",
                                width:
                                  n.data?.imageSize === "fill"
                                    ? "100%"
                                    : "auto",
                                height:
                                  n.data?.imageSize === "fill"
                                    ? "100%"
                                    : "auto",
                                objectFit:
                                  n.data?.imageSize === "fill"
                                    ? "cover"
                                    : n.data?.imageSize === "fit"
                                      ? "scale-down"
                                      : "contain",
                                display: "block",
                                userSelect: "none",
                                pointerEvents: "none",
                                draggable: false,
                              } as React.CSSProperties
                            }
                          />
                        ) : (
                          <div
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              color: bodyText,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                              gap: "8px",
                            }}
                          >
                            {n.data?.displayText ? (
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: n.data?.isImageBroken
                                    ? "#dc2626"
                                    : bodyText,
                                  fontStyle: "italic",
                                  marginBottom: "8px",
                                  whiteSpace: "pre-line",
                                  textAlign: "center",
                                }}
                              >
                                {n.data?.isImageBroken && "⚠️ "}
                                {n.data.displayText}
                              </div>
                            ) : null}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onImageButtonClick?.(n.id);
                              }}
                              style={{
                                padding: "6px 12px",
                                fontSize: "11px",
                                border: `1px dashed ${border}`,
                                borderRadius: "4px",
                                background: "transparent",
                                color: bodyText,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = "#007bff";
                                e.currentTarget.style.color = "#007bff";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = border;
                                e.currentTarget.style.color = bodyText;
                              }}
                            >
                              📷 Add Image
                            </button>
                          </div>
                        )
                      ) : (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {props.inlineEditing?.nodeId === n.id && props.inlineEditing?.part === 'body' ? (
                            <InlineTextEditor
                              initialValue={n.data?.description || ''}
                              placeholder="Enter description..."
                              onSave={(value) => props.onInlineEditingSave?.(n.id, 'body', value)}
                              onCancel={() => props.onInlineEditingCancel?.()}
                              onSelectionChange={props.onTextSelectionChange}
                              color={bodyText}
                              fontSize={n.data?.fontSize || 12}
                              fontWeight={n.data?.bold ? 700 : 400}
                              textAlign={n.data?.textAlign || 'left'}
                              multiline
                              autoFocus
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: n.data?.fontSize ? `${n.data.fontSize}px` : '12px',
                                fontWeight: n.data?.bold ? 700 : 400,
                                fontStyle: n.data?.italic ? 'italic' : 'normal',
                                textDecoration: [
                                  n.data?.underline ? 'underline' : '',
                                  n.data?.strikethrough ? 'line-through' : ''
                                ].filter(Boolean).join(' ') || 'none',
                                textAlign: n.data?.textAlign || 'left',
                                display: 'block',
                                width: '100%',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {n.data?.description ? renderTextWithLinks(n.data.description) : "Drop content here…"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Status Badge - inline after content */}
                  {isStatusEnabled && (
                    <div
                      className="px-3 pb-2 flex items-center justify-end"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <StatusBadge 
                        status={n.data?.status || 'not-started'} 
                        onClick={() => props.onNodeStatusChange?.(n.id)}
                      />
                    </div>
                  )}
                  
                  {/* Hyperlink Footer Section - Supports Multiple Links */}
                  {(() => {
                    const hyperlinks = normalizeHyperlinks(n.data);
                    if (hyperlinks.length === 0) return null;
                    return (
                      <div
                        className="hyperlink-footer"
                        style={{
                          backgroundColor: bodyBg,
                          padding: '8px 12px',
                          borderRadius: `0 0 ${cornerRadius - 2}px ${cornerRadius - 2}px`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          overflow: 'visible',
                        }}
                        data-testid={`node-hyperlinks-${n.id}`}
                      >
                        {hyperlinks.map((link) => (
                          <HyperlinkFooterItem
                            key={link.id}
                            hyperlink={link}
                            onEdit={() => props.onHyperlinkEdit?.(n.id, link.id)}
                            onDelete={() => props.onHyperlinkDelete?.(n.id, link.id)}
                          />
                        ))}
                      </div>
                    );
                  })()}
                  
                  {!props.readOnly && n.showHandles !== false && !draggingNodeId && (
                    <NodeHandles
                      node={n}
                      scale={viewport.zoom}
                      onHandleConnect={(p, e) => {
                        if (!containerRef.current) return;
                        const rect =
                          containerRef.current.getBoundingClientRect();
                        const wp = clientToWorld(
                          e.clientX,
                          e.clientY,
                          viewport,
                          rect,
                        );
                        setConnecting({
                          sourceId: n.id,
                          wx: wp.x,
                          wy: wp.y,
                          hoverTargetId: null,
                          eligible: false,
                        });
                      }}
                      proFeatures={props.proFeatures}
                      onQuickAdd={props.onQuickAdd}
                    />
                  )}

                  {/* Emoji reactions */}
                  <div className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1">
                    <EmojiReactions
                      nodeId={n.id}
                      reactions={n.data?.reactions}
                      onAddReaction={(nodeId, emoji) => {
                        const updatedNodes = props.nodes.map((node) => {
                          if (node.id === nodeId) {
                            const reactions = node.data?.reactions || {};
                            const reaction = reactions[emoji] || {
                              count: 0,
                              userIds: [],
                            };
                            return {
                              ...node,
                              data: {
                                ...node.data,
                                reactions: {
                                  ...reactions,
                                  [emoji]: {
                                    count: reaction.count + 1,
                                    userIds: [
                                      ...reaction.userIds,
                                      props.currentUserId || "current-user",
                                    ],
                                  },
                                },
                              },
                            };
                          }
                          return node;
                        });
                        props.onNodesChange?.(updatedNodes);
                      }}
                      onRemoveReaction={(nodeId, emoji) => {
                        const updatedNodes = props.nodes.map((node) => {
                          if (node.id === nodeId) {
                            const reactions = node.data?.reactions || {};
                            const reaction = reactions[emoji];
                            if (reaction) {
                              const newUserIds = reaction.userIds.filter(
                                (id: string) =>
                                  id !==
                                  (props.currentUserId || "current-user"),
                              );
                              const newCount = Math.max(0, reaction.count - 1);
                              return {
                                ...node,
                                data: {
                                  ...node.data,
                                  reactions: {
                                    ...reactions,
                                    [emoji]: {
                                      count: newCount,
                                      userIds: newUserIds,
                                    },
                                  },
                                },
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
          {visibleCanvasObjects
            .filter((obj) => !obj.hidden)
            .map((obj) => {
              // Helper functions for canvas object reactions
              const addCanvasObjectReaction = (
                objectId: string,
                emoji: string,
              ) => {
                const updatedObjects = (props.canvasObjects || []).map(
                  (canvasObject) => {
                    if (canvasObject.id === objectId) {
                      const reactions = canvasObject.reactions || {};
                      const reaction = reactions[emoji] || {
                        emoji,
                        count: 0,
                        userIds: [],
                      };
                      return {
                        ...canvasObject,
                        reactions: {
                          ...reactions,
                          [emoji]: {
                            emoji,
                            count: reaction.count + 1,
                            userIds: [
                              ...reaction.userIds,
                              props.currentUserId || "current-user",
                            ],
                          },
                        },
                      };
                    }
                    return canvasObject;
                  },
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              };

              const removeCanvasObjectReaction = (
                objectId: string,
                emoji: string,
              ) => {
                const updatedObjects = (props.canvasObjects || []).map(
                  (canvasObject) => {
                    if (canvasObject.id === objectId) {
                      const reactions = canvasObject.reactions || {};
                      const reaction = reactions[emoji];
                      if (reaction) {
                        const newUserIds = reaction.userIds.filter(
                          (id: string) =>
                            id !== (props.currentUserId || "current-user"),
                        );
                        const newCount = Math.max(0, reaction.count - 1);
                        return {
                          ...canvasObject,
                          reactions: {
                            ...reactions,
                            [emoji]: {
                              emoji,
                              count: newCount,
                              userIds: newUserIds,
                            },
                          },
                        };
                      }
                    }
                    return canvasObject;
                  },
                );
                props.onCanvasObjectsChange?.(updatedObjects);
              };

              // Canvas object drag handler with threshold-based interaction
              const handleCanvasObjectDragStart = (
                objectId: string,
                e: React.MouseEvent,
              ) => {
                e.preventDefault();
                e.stopPropagation();
                if (!containerRef.current) return;

                const rect = containerRef.current.getBoundingClientRect();
                const wp = clientToWorld(e.clientX, e.clientY, viewport, rect);
                const targetObject = (props.canvasObjects || []).find(
                  (obj) => obj.id === objectId,
                );

                if (targetObject) {
                  // Dispatch global canvas object drag start event to cancel click timers
                  window.dispatchEvent(
                    new CustomEvent("canvasObjectDragStart", {
                      detail: { objectId },
                    }),
                  );

                  // Initialize drag state without immediate selection - selection happens on mouseup if no movement
                  canvasObjectDragInfo.current = {
                    id: objectId,
                    start: wp,
                    last: wp,
                    origin: { ...targetObject.position },
                    hasMoved: false,
                    originalEvent: e,
                  };
                }
              };

              // Render different canvas object types
              if (obj.type === "text") {
                return (
                  <TextObject
                    key={obj.id}
                    object={
                      obj as CanvasObject & {
                        data: import("../types").TextNodeData;
                      }
                    }
                    selectedCanvasObjectCount={selectedCanvasObjectCount}
                    onUpdate={(updates) => {
                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                data: { ...canvasObject.data, ...updates },
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onResize={(width, height, resizeInfo) => {
                      const currentObject = (props.canvasObjects || []).find(
                        (co) => co.id === obj.id,
                      );
                      if (!currentObject) return;

                      const currentWidth =
                        currentObject.style?.width ||
                        currentObject.width ||
                        200;
                      const currentHeight =
                        currentObject.style?.height ||
                        currentObject.height ||
                        150;
                      const currentPos = currentObject.position;

                      // Calculate position adjustment based on handle position
                      const deltaWidth = width - currentWidth;
                      const deltaHeight = height - currentHeight;

                      let newPosition = { ...currentPos };

                      // Adjust position based on which corner is being dragged
                      if (resizeInfo?.position) {
                        switch (resizeInfo.position) {
                          case "top-left":
                            // When dragging top-left, object grows/shrinks towards top-left
                            newPosition.x -= deltaWidth;
                            newPosition.y -= deltaHeight;
                            break;
                          case "top-right":
                            // When dragging top-right, object grows/shrinks towards top-right
                            // x stays same, y moves up when growing
                            newPosition.y -= deltaHeight;
                            break;
                          case "bottom-left":
                            // When dragging bottom-left, object grows/shrinks towards bottom-left
                            // y stays same, x moves left when growing
                            newPosition.x -= deltaWidth;
                            break;
                          case "bottom-right":
                            // When dragging bottom-right, object grows/shrinks towards bottom-right
                            // Both x and y stay same (this is the default behavior)
                            break;
                        }
                      }

                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                style: { ...canvasObject.style, width, height },
                                position: newPosition,
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onStartDrag={(e) => handleCanvasObjectDragStart(obj.id, e)}
                    onClick={(e) => handleCanvasObjectClick(obj.id, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      props.onCanvasObjectRightClick?.(e, obj);
                    }}
                    onAddReaction={addCanvasObjectReaction}
                    onRemoveReaction={removeCanvasObjectReaction}
                    onHyperlinkEdit={() => {
                      props.onTextObjectHyperlinkEdit?.(obj.id);
                    }}
                    onHyperlinkDelete={() => {
                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                data: { ...canvasObject.data, hyperlink: undefined },
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    viewport={viewport}
                  />
                );
              }

              if (obj.type === "sticky") {
                return (
                  <StickyNoteObject
                    key={obj.id}
                    object={
                      obj as CanvasObject & {
                        data: import("../types").StickyNoteData;
                      }
                    }
                    selectedCanvasObjectCount={selectedCanvasObjectCount}
                    onUpdate={(updates) => {
                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                data: { ...canvasObject.data, ...updates },
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onResize={(width, height, resizeInfo) => {
                      const currentObject = (props.canvasObjects || []).find(
                        (co) => co.id === obj.id,
                      );
                      if (!currentObject) return;

                      const currentWidth =
                        currentObject.style?.width ||
                        currentObject.width ||
                        200;
                      const currentHeight =
                        currentObject.style?.height ||
                        currentObject.height ||
                        150;
                      const currentPos = currentObject.position;

                      // Calculate position adjustment based on handle position
                      const deltaWidth = width - currentWidth;
                      const deltaHeight = height - currentHeight;

                      let newPosition = { ...currentPos };

                      // Adjust position based on which corner is being dragged
                      if (resizeInfo?.position) {
                        switch (resizeInfo.position) {
                          case "top-left":
                            // When dragging top-left, object grows/shrinks towards top-left
                            newPosition.x -= deltaWidth;
                            newPosition.y -= deltaHeight;
                            break;
                          case "top-right":
                            // When dragging top-right, object grows/shrinks towards top-right
                            // x stays same, y moves up when growing
                            newPosition.y -= deltaHeight;
                            break;
                          case "bottom-left":
                            // When dragging bottom-left, object grows/shrinks towards bottom-left
                            // y stays same, x moves left when growing
                            newPosition.x -= deltaWidth;
                            break;
                          case "bottom-right":
                            // When dragging bottom-right, object grows/shrinks towards bottom-right
                            // Both x and y stay same (this is the default behavior)
                            break;
                        }
                      }

                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                style: { ...canvasObject.style, width, height },
                                position: newPosition,
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onDelete={() => {
                      const updatedObjects = (props.canvasObjects || []).filter(
                        (canvasObject) => canvasObject.id !== obj.id,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onStartDrag={(e) => handleCanvasObjectDragStart(obj.id, e)}
                    onClick={(e) => handleCanvasObjectClick(obj.id, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      props.onCanvasObjectRightClick?.(e, obj);
                    }}
                    onAddReaction={addCanvasObjectReaction}
                    onRemoveReaction={removeCanvasObjectReaction}
                    viewport={viewport}
                  />
                );
              }

              if (obj.type === "shape") {
                return (
                  <ShapeObject
                    key={obj.id}
                    object={
                      obj as CanvasObject & {
                        data: import("../types").ShapeNodeData;
                      }
                    }
                    selectedCanvasObjectCount={selectedCanvasObjectCount}
                    onUpdate={(updates) => {
                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                data: { ...canvasObject.data, ...updates },
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onResize={(width, height, resizeInfo) => {
                      const currentObject = (props.canvasObjects || []).find(
                        (co) => co.id === obj.id,
                      );
                      if (!currentObject) return;

                      const currentWidth =
                        currentObject.style?.width ||
                        currentObject.width ||
                        200;
                      const currentHeight =
                        currentObject.style?.height ||
                        currentObject.height ||
                        150;
                      const currentPos = currentObject.position;

                      // Calculate position adjustment based on handle position
                      const deltaWidth = width - currentWidth;
                      const deltaHeight = height - currentHeight;

                      let newPosition = { ...currentPos };

                      // Adjust position based on which corner is being dragged
                      if (resizeInfo?.position) {
                        switch (resizeInfo.position) {
                          case "top-left":
                            // When dragging top-left, object grows/shrinks towards top-left
                            newPosition.x -= deltaWidth;
                            newPosition.y -= deltaHeight;
                            break;
                          case "top-right":
                            // When dragging top-right, object grows/shrinks towards top-right
                            // x stays same, y moves up when growing
                            newPosition.y -= deltaHeight;
                            break;
                          case "bottom-left":
                            // When dragging bottom-left, object grows/shrinks towards bottom-left
                            // y stays same, x moves left when growing
                            newPosition.x -= deltaWidth;
                            break;
                          case "bottom-right":
                            // When dragging bottom-right, object grows/shrinks towards bottom-right
                            // Both x and y stay same (this is the default behavior)
                            break;
                        }
                      }

                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === obj.id
                            ? {
                                ...canvasObject,
                                style: { ...canvasObject.style, width, height },
                                position: newPosition,
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onStartDrag={(e) => handleCanvasObjectDragStart(obj.id, e)}
                    onClick={(e) => handleCanvasObjectClick(obj.id, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      props.onCanvasObjectRightClick?.(e, obj);
                    }}
                    onAddReaction={addCanvasObjectReaction}
                    onRemoveReaction={removeCanvasObjectReaction}
                    viewport={viewport}
                    onEndpointDragStart={(endpoint, e) => {
                      // Get the shape data to find current endpoint position
                      const shapeData = obj.data as import("../types").ShapeNodeData;
                      const shapeWidth = obj.style?.width || obj.width || 150;
                      const shapeHeight = obj.style?.height || obj.height || 50;
                      
                      // Get the current endpoint position (relative to shape)
                      const endpointPos = endpoint === 'start' 
                        ? (shapeData.startPoint ?? { x: 0, y: shapeHeight / 2 })
                        : (shapeData.endPoint ?? { x: shapeWidth, y: shapeHeight / 2 });
                      
                      endpointDragInfo.current = {
                        objectId: obj.id,
                        endpoint,
                        start: { x: e.clientX, y: e.clientY },
                        origin: endpointPos,
                      };
                      e.stopPropagation();
                    }}
                    canvasRef={containerRef}
                    onPolygonPointAdd={(objectId: string, point: { x: number; y: number }) => {
                      // Add point and auto-expand bounds
                      const shapeData = obj.data as import("../types").ShapeNodeData;
                      const currentPoints = shapeData.points || [];
                      const newPoints = [...currentPoints, point];
                      
                      // Calculate bounding box of all points (in local coordinates)
                      const padding = 20;
                      const minX = Math.min(...newPoints.map(p => p.x));
                      const minY = Math.min(...newPoints.map(p => p.y));
                      const maxX = Math.max(...newPoints.map(p => p.x));
                      const maxY = Math.max(...newPoints.map(p => p.y));
                      
                      // Calculate new dimensions with padding
                      const newWidth = Math.max(maxX - minX + padding * 2, 100);
                      const newHeight = Math.max(maxY - minY + padding * 2, 100);
                      
                      // If points extend into negative local space, we need to:
                      // 1. Shift shape position in world space
                      // 2. Normalize points so they stay in positive local space
                      const shiftX = minX < padding ? minX - padding : 0;
                      const shiftY = minY < padding ? minY - padding : 0;
                      
                      // Normalize points to new local origin (shifted by -shiftX, -shiftY)
                      const normalizedPoints = newPoints.map(p => ({
                        x: p.x - shiftX,
                        y: p.y - shiftY
                      }));
                      
                      // Update world position to compensate for the shift
                      const newPosition = {
                        x: obj.position.x + shiftX,
                        y: obj.position.y + shiftY
                      };
                      
                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === objectId
                            ? {
                                ...canvasObject,
                                data: { ...canvasObject.data, points: normalizedPoints },
                                position: newPosition,
                                width: newWidth,
                                height: newHeight,
                                style: { ...canvasObject.style, width: newWidth, height: newHeight }
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                    onPolygonClose={(objectId: string) => {
                      const updatedObjects = (props.canvasObjects || []).map(
                        (canvasObject) =>
                          canvasObject.id === objectId
                            ? {
                                ...canvasObject,
                                data: { ...canvasObject.data, isClosed: true, isCreating: false },
                              }
                            : canvasObject,
                      );
                      props.onCanvasObjectsChange?.(updatedObjects);
                    }}
                  />
                );
              }

              return null;
            })}
        </div>

        {/* Smart Guides Overlay */}
        <SnapGuides
          guides={currentGuides}
          canvasSize={{ width: 2000, height: 1500 }}
          viewport={viewport}
          show={
            currentGuides.length > 0 &&
            props.proFeatures?.smartGuides?.showGuides !== false
          }
        />

        {/* Unified Selection rectangle (for both nodes and canvas objects) */}
        {unifiedSelectionRect && (
          <div
            className="kiteframe-select-rect"
            style={{
              position: "absolute",
              left: unifiedSelectionRect.x,
              top: unifiedSelectionRect.y,
              width: unifiedSelectionRect.w,
              height: unifiedSelectionRect.h,
              border: "2px dashed #8b5cf6",
              backgroundColor: "rgba(139, 92, 246, 0.15)",
              pointerEvents: "none",
              zIndex: 1000,
            }}
          />
        )}


        {/* ========== PRODUCTION FEATURES UI FEEDBACK ========== */}
        {/* Memory Warning */}
        {memoryWarning && (
          <div
            style={{
              position: "absolute",
              top: 60,
              right: 20,
              padding: "12px 16px",
              background:
                memoryWarning.level === "critical" ? "#dc2626" : "#f59e0b",
              color: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "14px",
              fontWeight: "500",
              zIndex: 10000,
              animation:
                memoryWarning.level === "critical"
                  ? "pulse 1s infinite"
                  : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>⚠️</span>
              <div>
                <div>
                  {memoryWarning.level === "critical" ? "Critical" : "High"}{" "}
                  Memory Usage
                </div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>
                  {(memoryWarning.percentage * 100).toFixed(1)}% used
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rate Limit Warning */}
        {rateLimitWarning && (
          <div
            style={{
              position: "absolute",
              top: memoryWarning ? 130 : 60,
              right: 20,
              padding: "12px 16px",
              background: "#ef4444",
              color: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "14px",
              fontWeight: "500",
              zIndex: 10000,
              animation: "slideInRight 0.3s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🚫</span>
              <div>
                <div>Rate Limit Exceeded</div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>
                  Please slow down
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Notification */}
        {showRecoveryNotification && recoveryState && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "12px 20px",
              background: "#10b981",
              color: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "14px",
              fontWeight: "500",
              zIndex: 10000,
              animation: "slideInDown 0.3s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>✅</span>
              <div>
                <div>Canvas Recovered</div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>
                  Restored from{" "}
                  {new Date(recoveryState.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => setShowRecoveryNotification(false)}
                style={{
                  marginLeft: "12px",
                  padding: "4px",
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Performance Metrics Display (Development Mode) */}
        {process.env.NODE_ENV === "development" && showPerformance && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              padding: "8px 12px",
              background: "rgba(0, 0, 0, 0.8)",
              color: "#00ff00",
              fontFamily: "monospace",
              fontSize: "10px",
              borderRadius: "4px",
              cursor: "pointer",
              userSelect: "none",
              zIndex: 9999,
            }}
            onClick={() => setShowMetrics(!showMetrics)}
            title="Click to toggle detailed metrics"
          >
            <div>📊 Performance</div>
            {showMetrics && (
              <>
                <div
                  style={{
                    marginTop: "4px",
                    borderTop: "1px solid #00ff00",
                    paddingTop: "4px",
                  }}
                >
                  <div>
                    Visible: {visibleNodes.length}/{props.nodes.length} nodes
                  </div>
                  <div>
                    Visible: {visibleEdges.length}/{props.edges.length} edges
                  </div>
                  <div>
                    Visible: {visibleCanvasObjects.length}/
                    {(props.canvasObjects || []).length} objects
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    borderTop: "1px solid #00ff00",
                    paddingTop: "4px",
                  }}
                >
                  <div>Batches: {metrics.totalBatches}</div>
                  <div>Updates: {metrics.totalUpdates}</div>
                  <div>Avg Frame: {metrics.averageFrameTime.toFixed(2)}ms</div>
                  <div>Dropped: {metrics.droppedFrames}</div>
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    borderTop: "1px solid #00ff00",
                    paddingTop: "4px",
                  }}
                >
                  <div>FPS Target: 60</div>
                  <div>Buffer: 200px</div>
                  <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
                </div>
                {memoryWarning && (
                  <div
                    style={{
                      marginTop: "4px",
                      borderTop: "1px solid #ff0000",
                      paddingTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        color:
                          memoryWarning.level === "critical"
                            ? "#ff0000"
                            : "#ffaa00",
                      }}
                    >
                      Memory: {(memoryWarning.percentage * 100).toFixed(1)}%{" "}
                      {memoryWarning.level}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Data Link Picker Modal for Form Nodes */}
        {dataLinkPicker && (
          <DataLinkPicker
            isOpen={dataLinkPicker.isOpen}
            onClose={() => setDataLinkPicker(null)}
            tables={Object.values(props.tableData || {})}
            currentLink={dataLinkPicker.currentLink}
            onSelect={(link) => {
              if (!dataLinkPicker || !link) return;
              
              const formNode = props.nodes.find(n => n.id === dataLinkPicker.formNodeId);
              if (!formNode || formNode.type !== 'form') return;
              
              const formData = formNode.data as any;
              const updatedFields = (formData.fields || []).map((field: any) =>
                field.id === dataLinkPicker.fieldId
                  ? { ...field, dataLink: link, value: link.displayValue || '' }
                  : field
              );
              
              const updatedNodes = props.nodes.map(node =>
                node.id === dataLinkPicker.formNodeId
                  ? { ...node, data: { ...formData, fields: updatedFields } }
                  : node
              );
              
              props.onNodesChange?.(updatedNodes);
              setDataLinkPicker(null);
            }}
          />
        )}

        {/* Variable Name Dialog for Table→Code connections */}
        {pendingTableToCodeConnection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setPendingTableToCodeConnection(null);
                setVariableNameInput('');
              }}
            />
            <div 
              className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[380px] overflow-hidden"
              data-testid="variable-name-dialog"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <Table2 size={18} className="text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Link Data to Code
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setPendingTableToCodeConnection(null);
                    setVariableNameInput('');
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  data-testid="variable-name-dialog-close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose a variable name to access <span className="font-medium text-indigo-600 dark:text-indigo-400">{pendingTableToCodeConnection.sourceNodeName}</span> data in your code.
                </p>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Variable Name
                  </label>
                  <input
                    type="text"
                    value={variableNameInput}
                    onChange={(e) => setVariableNameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && variableNameInput.trim()) {
                        props.onConnect?.({
                          source: pendingTableToCodeConnection.sourceId,
                          target: pendingTableToCodeConnection.targetId,
                          data: { variableName: variableNameInput.trim() }
                        });
                        setPendingTableToCodeConnection(null);
                        setVariableNameInput('');
                      } else if (e.key === 'Escape') {
                        setPendingTableToCodeConnection(null);
                        setVariableNameInput('');
                      }
                    }}
                    placeholder="e.g., products, users, orderData"
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                    data-testid="variable-name-input"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Use this variable in your code: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{variableNameInput || 'variableName'}</code>
                  </p>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 text-xs">
                  <p className="text-indigo-700 dark:text-indigo-300">
                    <span className="font-medium">Example:</span> Access data with <code className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-800 rounded">{variableNameInput || 'data'}.filter(r =&gt; r.status === 'active')</code>
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                <button
                  onClick={() => {
                    setPendingTableToCodeConnection(null);
                    setVariableNameInput('');
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  data-testid="variable-name-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (variableNameInput.trim()) {
                      props.onConnect?.({
                        source: pendingTableToCodeConnection.sourceId,
                        target: pendingTableToCodeConnection.targetId,
                        data: { variableName: variableNameInput.trim() }
                      });
                      setPendingTableToCodeConnection(null);
                      setVariableNameInput('');
                    }
                  }}
                  disabled={!variableNameInput.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  data-testid="variable-name-confirm"
                >
                  Link Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
