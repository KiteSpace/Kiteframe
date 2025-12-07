import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import DragPlaceholder from './DragPlaceholder';
import { 
  Globe, 
  ExternalLink, 
  RefreshCw, 
  Maximize2,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { Node, WebviewNodeData, WebviewNodeComponentProps } from '../types';
import { sanitizeText } from '../utils/validation';
import { getBorderColorFromHeader } from '@/lib/themes';

const MIN_WEBVIEW_WIDTH = 280;
const MIN_WEBVIEW_HEIGHT = 200;
const DEFAULT_WEBVIEW_WIDTH = 480;
const DEFAULT_WEBVIEW_HEIGHT = 360;
const HEADER_HEIGHT = 40;

const KNOWN_SERVICES: Record<string, { name: string; icon: string; color: string }> = {
  'figma.com': { name: 'Figma', icon: 'figma', color: '#F24E1E' },
  'replit.com': { name: 'Replit', icon: 'replit', color: '#F26207' },
  'replit.app': { name: 'Replit App', icon: 'replit', color: '#F26207' },
  'framer.com': { name: 'Framer', icon: 'framer', color: '#0055FF' },
  'codepen.io': { name: 'CodePen', icon: 'codepen', color: '#1E1F26' },
  'codesandbox.io': { name: 'CodeSandbox', icon: 'codesandbox', color: '#151515' },
  'github.com': { name: 'GitHub', icon: 'github', color: '#24292E' },
  'notion.so': { name: 'Notion', icon: 'notion', color: '#000000' },
  'miro.com': { name: 'Miro', icon: 'miro', color: '#FFD02F' },
  'youtube.com': { name: 'YouTube', icon: 'youtube', color: '#FF0000' },
  'youtu.be': { name: 'YouTube', icon: 'youtube', color: '#FF0000' },
  'vimeo.com': { name: 'Vimeo', icon: 'vimeo', color: '#1AB7EA' },
  'loom.com': { name: 'Loom', icon: 'loom', color: '#625DF5' },
};

function getDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getServiceInfo(url: string): { name: string; icon: string; color: string } | null {
  const domain = getDomainFromUrl(url);
  if (!domain) return null;
  
  for (const [key, value] of Object.entries(KNOWN_SERVICES)) {
    if (domain.endsWith(key)) {
      return value;
    }
  }
  return null;
}

function getFaviconUrl(url: string): string {
  const domain = getDomainFromUrl(url);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

interface FullscreenModalProps {
  url: string;
  title: string;
  favicon?: string;
  onClose: () => void;
}

const FullscreenModal: React.FC<FullscreenModalProps> = ({ url, title, favicon, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/80 flex flex-col"
      onClick={onClose}
    >
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {favicon && (
            <img src={favicon} alt="" className="w-5 h-5 object-contain" />
          )}
          <span className="text-white font-medium truncate max-w-md">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={18} />
          </a>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div 
        className="flex-1 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-popups allow-forms"
          allow="fullscreen"
          loading="lazy"
          title={title}
        />
      </div>
    </div>,
    document.body
  );
};

const WebviewNodeComponent: React.FC<WebviewNodeComponentProps> = ({
  node,
  onUpdate,
  onDoubleClick,
  onFocusNode,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  showDragPlaceholder = false,
  isAnyDragActive = false,
  onOpenFullscreen,
}) => {
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState(node.data.url || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.title || '');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const url = node.data.url || '';
  const title = node.data.title || 'Web View';
  
  const nodeWidth = node.style?.width || node.width || DEFAULT_WEBVIEW_WIDTH;
  const nodeHeight = node.style?.height || node.height || DEFAULT_WEBVIEW_HEIGHT;
  
  const headerColor = node.data.colors?.headerBackground || '#06b6d4';
  const bodyColor = node.data.colors?.bodyBackground || '#ffffff';
  const borderColor = node.data.colors?.borderColor || getBorderColorFromHeader(headerColor);
  const headerTextColor = node.data.colors?.headerTextColor || '#ffffff';

  const serviceInfo = useMemo(() => url ? getServiceInfo(url) : null, [url]);
  const favicon = useMemo(() => {
    if (node.data.favicon) return node.data.favicon;
    if (url) return getFaviconUrl(url);
    return '';
  }, [url, node.data.favicon]);

  useEffect(() => {
    if (isEditingUrl && urlInputRef.current) {
      urlInputRef.current.focus();
      urlInputRef.current.select();
    }
  }, [isEditingUrl]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, iframe, [contenteditable="true"]');
    if (isInteractiveElement) return;
    e.stopPropagation();
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e, node);
  }, [onClick, node]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) {
      setIsEditingUrl(true);
    }
    onDoubleClick?.(e);
  }, [url, onDoubleClick]);

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  }, []);

  const handleTitleSubmit = useCallback(() => {
    const sanitizedTitle = sanitizeText(editTitleValue.trim() || 'Web View');
    onUpdate?.(node.id, {
      data: { ...node.data, title: sanitizedTitle },
    });
    setIsEditingTitle(false);
  }, [editTitleValue, node.id, node.data, onUpdate]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditTitleValue(node.data.title || 'Web View');
      setIsEditingTitle(false);
    }
  }, [handleTitleSubmit, node.data.title]);

  const handleUrlSubmit = useCallback(() => {
    let finalUrl = editUrlValue.trim();
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    
    const service = finalUrl ? getServiceInfo(finalUrl) : null;
    const newFavicon = finalUrl ? getFaviconUrl(finalUrl) : '';
    
    onUpdate?.(node.id, {
      data: { 
        ...node.data, 
        url: finalUrl,
        serviceName: service?.name,
        serviceIcon: service?.icon,
        favicon: newFavicon,
        title: node.data.title || service?.name || 'Web View',
      },
    });
    setIsEditingUrl(false);
    setLoadError(null);
    if (finalUrl) setIsLoading(true);
  }, [editUrlValue, node.id, node.data, onUpdate]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditUrlValue(node.data.url || '');
      setIsEditingUrl(false);
    }
  }, [handleUrlSubmit, node.data.url]);

  const handleResize = useCallback((width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height },
      });
    }
  }, [node.id, node.style, onUpdate]);

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (iframeRef.current && url) {
      setIsLoading(true);
      setLoadError(null);
      iframeRef.current.src = url;
    }
  }, [url]);

  const handleOpenExternal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const handleOpenFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullscreen(true);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setLoadError(null);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setLoadError('Failed to load content');
  }, []);

  if (showDragPlaceholder) {
    return (
      <DragPlaceholder
        nodeType="webview"
        width={nodeWidth}
        height={nodeHeight}
        label={title}
        selected={node.selected}
        favicon={favicon}
      />
    );
  }

  return (
    <>
      <div
        ref={nodeRef}
        className={cn(
          "absolute rounded-lg overflow-hidden shadow-lg transition-shadow",
          node.selected && "ring-2 ring-cyan-500 ring-offset-1",
          className
        )}
        style={{
          ...style,
          left: node.position.x,
          top: node.position.y,
          width: nodeWidth,
          height: nodeHeight,
          minWidth: MIN_WEBVIEW_WIDTH,
          minHeight: MIN_WEBVIEW_HEIGHT,
          zIndex: node.zIndex || 0,
          border: `1px solid ${borderColor}`,
          backgroundColor: bodyColor,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        data-testid={`webview-node-${node.id}`}
      >
        {showHandles && !isAnyDragActive && (
          <NodeHandles
            node={{ ...node, width: nodeWidth, height: nodeHeight }}
            scale={viewport?.zoom || 1}
            onHandleConnect={onHandleConnect}
          />
        )}

        <div
          className="flex items-center justify-between px-3 h-10 cursor-move"
          style={{ 
            backgroundColor: headerColor,
            color: headerTextColor,
          }}
          onDoubleClick={handleTitleDoubleClick}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {favicon ? (
              <img 
                src={favicon} 
                alt="" 
                className="w-4 h-4 object-contain flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe size={16} className="flex-shrink-0 opacity-80" />
            )}
            
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-1 bg-white/20 text-white placeholder-white/60 px-2 py-0.5 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/50"
                placeholder="Enter title..."
                data-testid="webview-title-input"
              />
            ) : (
              <span className="font-medium text-sm truncate">{title}</span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              title="Refresh"
              data-testid="webview-refresh"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleOpenFullscreen}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              title="Fullscreen"
              data-testid="webview-fullscreen"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={handleOpenExternal}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              title="Open in new tab"
              data-testid="webview-external"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        <div 
          className="relative"
          style={{ 
            height: nodeHeight - HEADER_HEIGHT,
            backgroundColor: bodyColor,
          }}
        >
          {!url || isEditingUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4">
              <Globe size={48} className="text-gray-300 dark:text-gray-600" />
              <div className="w-full max-w-sm">
                <input
                  ref={urlInputRef}
                  type="url"
                  value={editUrlValue}
                  onChange={(e) => setEditUrlValue(e.target.value)}
                  onBlur={handleUrlSubmit}
                  onKeyDown={handleUrlKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Enter URL (e.g., https://figma.com/embed/...)"
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  data-testid="webview-url-input"
                />
                <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
                  Paste a URL to embed Figma, Replit, or any website
                </p>
              </div>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                  <Loader2 size={32} className="text-cyan-500 animate-spin" />
                </div>
              )}
              {loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-3 z-10">
                  <AlertCircle size={32} className="text-red-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">{loadError}</p>
                  <button
                    onClick={() => setIsEditingUrl(true)}
                    className="text-sm text-cyan-600 hover:underline"
                  >
                    Edit URL
                  </button>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-popups allow-forms"
                allow="fullscreen"
                loading="lazy"
                title={title}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                data-testid="webview-iframe"
              />
            </>
          )}
        </div>

        {showResizeHandle && node.resizable !== false && node.selected && !showDragPlaceholder && (
          <ResizeHandle
            position="bottom-right"
            nodeRef={nodeRef}
            onResize={handleResize}
            minWidth={MIN_WEBVIEW_WIDTH}
            minHeight={MIN_WEBVIEW_HEIGHT}
            viewport={viewport}
          />
        )}
      </div>

      {showFullscreen && url && (
        <FullscreenModal
          url={url}
          title={title}
          favicon={favicon}
          onClose={() => setShowFullscreen(false)}
        />
      )}
    </>
  );
};

export const WebviewNode = memo(WebviewNodeComponent);
export default WebviewNode;
