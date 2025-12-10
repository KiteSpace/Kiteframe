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
  Loader2,
  Link2,
  Pencil
} from 'lucide-react';
import type { Node, WebviewNodeData, WebviewNodeComponentProps } from '../types';
import { sanitizeText } from '../utils/validation';
import { getBorderColorFromHeader } from '@/lib/themes';

const EMBED_BLOCK_TIMEOUT_MS = 5000;

const KNOWN_BLOCKING_DOMAINS = [
  'google.com',
  'google.',
  'facebook.com',
  'fb.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'instagram.com',
  'amazon.com',
  'netflix.com',
  'apple.com',
  'microsoft.com',
  'outlook.com',
  'live.com',
  'dropbox.com',
  'slack.com',
  'discord.com',
  'twitch.tv',
  'reddit.com',
  'pinterest.com',
  'tiktok.com',
  'whatsapp.com',
  'telegram.org',
];

function isKnownBlockingDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return KNOWN_BLOCKING_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

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
  onConvertToLink,
}) => {
  const [showInlineUrlInput, setShowInlineUrlInput] = useState(false);
  const [inlineUrlValue, setInlineUrlValue] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.title || '');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isEmbedBlocked, setIsEmbedBlocked] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  
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
    if (showInlineUrlInput && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [showInlineUrlInput]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (url && isLoading) {
      hasLoadedRef.current = false;
      
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      loadTimeoutRef.current = setTimeout(() => {
        if (!hasLoadedRef.current) {
          setIsLoading(false);
          setIsEmbedBlocked(true);
          setLoadError('This site doesn\'t allow embedding');
        }
      }, EMBED_BLOCK_TIMEOUT_MS);
    }
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [url, isLoading]);

  useEffect(() => {
    if (url) {
      setIsLoading(true);
      setIsEmbedBlocked(false);
      setLoadError(null);
      hasLoadedRef.current = false;
    }
  }, [url]);

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
    onDoubleClick?.(e);
  }, [onDoubleClick]);

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

  const handleUrlSubmit = useCallback((urlValue: string) => {
    let finalUrl = urlValue.trim();
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
    setShowInlineUrlInput(false);
    setInlineUrlValue('');
    setLoadError(null);
    if (finalUrl) setIsLoading(true);
  }, [node.id, node.data, onUpdate]);

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
      setIsEmbedBlocked(false);
      hasLoadedRef.current = false;
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
    hasLoadedRef.current = true;
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    if (url && isKnownBlockingDomain(url)) {
      setIsLoading(false);
      setIsEmbedBlocked(true);
      setLoadError('This site doesn\'t allow embedding');
      return;
    }
    
    if (iframeRef.current && url) {
      try {
        const win = iframeRef.current.contentWindow;
        if (win) {
          try {
            const loc = win.location.href;
            if (loc === 'about:blank') {
              setTimeout(() => {
                try {
                  if (iframeRef.current?.contentWindow?.location?.href === 'about:blank') {
                    setIsLoading(false);
                    setIsEmbedBlocked(true);
                    setLoadError('This site doesn\'t allow embedding');
                  } else {
                    setIsLoading(false);
                    setLoadError(null);
                    setIsEmbedBlocked(false);
                  }
                } catch {
                  setIsLoading(false);
                  setLoadError(null);
                  setIsEmbedBlocked(false);
                }
              }, 1000);
              return;
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
    }
    
    setIsLoading(false);
    setLoadError(null);
    setIsEmbedBlocked(false);
  }, [url]);

  const handleIframeError = useCallback(() => {
    hasLoadedRef.current = true;
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setIsLoading(false);
    setIsEmbedBlocked(false);
    setLoadError('Failed to load content');
  }, []);

  const handleConvertToLink = useCallback(() => {
    if (onConvertToLink && url) {
      onConvertToLink(node.id, url, title);
    }
    setShowConvertDialog(false);
  }, [onConvertToLink, node.id, url, title]);

  const handleShowUrlInput = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineUrlValue(url);
    setShowInlineUrlInput(true);
  }, [url]);

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

  const hasUrl = !!url && !loadError;

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
            {url && (
              <>
                <button
                  onClick={handleShowUrlInput}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Edit URL"
                  data-testid="webview-edit-url"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={handleRefresh}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Refresh"
                  data-testid="webview-refresh"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={handleOpenFullscreen}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Fullscreen"
                  data-testid="webview-fullscreen"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  onClick={handleOpenExternal}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Open in new tab"
                  data-testid="webview-external"
                >
                  <ExternalLink size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div 
          className="relative"
          style={{ 
            height: nodeHeight - HEADER_HEIGHT,
            backgroundColor: bodyColor,
          }}
        >
          {showInlineUrlInput ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
              <Globe size={32} className="text-gray-300 dark:text-gray-600 mb-4" />
              <div className="w-full max-w-sm">
                <input
                  ref={urlInputRef}
                  type="text"
                  value={inlineUrlValue}
                  onChange={(e) => setInlineUrlValue(e.target.value)}
                  placeholder="Enter URL (e.g., https://figma.com/embed/...)"
                  className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUrlSubmit(inlineUrlValue);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowInlineUrlInput(false);
                    }
                  }}
                  data-testid="webview-url-input"
                />
                <div className="flex justify-center gap-2 mt-3">
                  <button
                    className="px-4 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUrlSubmit(inlineUrlValue);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    data-testid="webview-url-save"
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowInlineUrlInput(false);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    data-testid="webview-url-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : !url ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4">
              <Globe size={48} className="text-gray-300 dark:text-gray-600" />
              <span className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                No URL set
              </span>
              <button
                onClick={handleShowUrlInput}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setShowInlineUrlInput(true); }}
                className="w-12 h-12 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full transition-colors shadow-md"
                title="Add URL"
                data-testid={`webview-node-url-btn-${node.id}`}
              >
                <Globe size={20} />
              </button>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                  <Loader2 size={32} className="text-cyan-500 animate-spin" />
                </div>
              )}
              {loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-3 z-10 p-4">
                  {url.includes('figma.com') ? (
                    <div className="w-10 h-10 rounded-lg bg-[#F24E1E]/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#F24E1E]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.354-3.019-3.019-3.019h-3.117V7.51z"/>
                        <path d="M8.148 24c2.476 0 4.49-2.014 4.49-4.49v-4.491H8.148c-2.476 0-4.49 2.014-4.49 4.491 0 2.476 2.014 4.49 4.49 4.49zm-3.019-4.49c0-1.664 1.355-3.019 3.019-3.019h3.117v3.019c0 1.665-1.354 3.019-3.019 3.019-1.664 0-3.117-1.354-3.117-3.019z"/>
                        <path d="M8.148 15.019h4.588V6.009H8.148c-2.476 0-4.49 2.014-4.49 4.505 0 2.476 2.014 4.505 4.49 4.505zm-3.019-4.505c0-1.664 1.355-3.033 3.019-3.033h3.117v6.067H8.148c-1.664 0-3.019-1.37-3.019-3.034z"/>
                        <path d="M15.852 15.019h-3.117V6.009h3.117c2.476 0 4.49 2.029 4.49 4.505s-2.014 4.505-4.49 4.505zm-1.647-7.538v6.067h1.647c1.665 0 3.019-1.37 3.019-3.034 0-1.664-1.354-3.033-3.019-3.033h-1.647z"/>
                        <path d="M8.148 8.981H3.658C1.182 8.981-.832 6.967-.832 4.49S1.182 0 3.658 0h4.49v8.981zm-4.49-7.51c-1.664 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V1.471H3.658z"/>
                      </svg>
                    </div>
                  ) : (
                    <AlertCircle size={32} className={isEmbedBlocked ? "text-amber-500" : "text-red-500"} />
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    {url.includes('figma.com') ? 'Unable to embed Figma file' : loadError}
                  </p>
                  
                  {isEmbedBlocked ? (
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-500 text-center max-w-xs">
                        {url.includes('figma.com') 
                          ? 'Make sure the Figma file is set to "Anyone with the link can view" in Share settings.'
                          : 'This website blocks embedding. You can convert this to a clickable link instead.'
                        }
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => setShowConvertDialog(true)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors"
                          data-testid="webview-convert-to-link"
                        >
                          <Link2 size={14} />
                          Convert to Link
                        </button>
                        <button
                          onClick={handleOpenExternal}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                            url.includes('figma.com')
                              ? 'bg-[#F24E1E] hover:bg-[#E04332] text-white'
                              : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                          data-testid="webview-open-external-error"
                        >
                          <ExternalLink size={14} />
                          {url.includes('figma.com') ? 'Open in Figma' : 'Open in Tab'}
                        </button>
                      </div>
                      <button
                        onClick={handleShowUrlInput}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-1"
                        data-testid="webview-edit-url"
                      >
                        Edit URL
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleShowUrlInput}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-sm text-cyan-600 hover:underline"
                      data-testid="webview-edit-url"
                    >
                      Edit URL
                    </button>
                  )}
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

      {showConvertDialog && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center"
          onClick={() => setShowConvertDialog(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-full">
                <Link2 size={20} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Convert to Link
              </h3>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This website doesn't allow embedding. Would you like to convert this webview node to a link node instead?
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">URL</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 break-all">{url}</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConvertDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                data-testid="convert-dialog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToLink}
                className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors"
                data-testid="convert-dialog-confirm"
              >
                Convert to Link
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export const WebviewNode = memo(WebviewNodeComponent);
export default WebviewNode;
