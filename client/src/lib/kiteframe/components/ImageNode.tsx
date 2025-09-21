import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import { Upload, Image as ImageIcon, ExternalLink, AlertCircle } from 'lucide-react';
import type { Node, ImageNodeData, ImageNodeComponentProps } from '../types';
import { getDynamicClassName, getNodeStyleClasses } from '../utils/styles';
import { sanitizeText } from '../utils/validation';


const ImageNodeComponent: React.FC<ImageNodeComponentProps> = ({
  node,
  onUpdate,
  onImageUpload,
  onImageUrlSet,
  onDoubleClick,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  viewport
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(node.data.label || '');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Focus URL input when shown
  useEffect(() => {
    if (showUrlInput && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [showUrlInput]);

  // Focus label input when entering edit mode
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.data.src) {
      // If no image, trigger upload
      handleUploadClick();
    }
    onDoubleClick?.(e);
  }, [node.data.src, handleUploadClick, onDoubleClick]);

  // Handle mouse down for dragging - integrate with canvas drag system
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag if not clicking on interactive elements
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, [contenteditable="true"]');
    
    if (isInteractiveElement) {
      return; // Don't start drag on interactive elements
    }
    
    e.stopPropagation();
    // Trigger the canvas drag system
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImageUpload) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10485760) {
      console.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setImageError(false);

    try {
      const imageUrl = await onImageUpload(node.id, file);
      
      // Update node with new image data
      if (onUpdate) {
        onUpdate(node.id, {
          data: {
            ...node.data,
            src: imageUrl,
            filename: file.name,
            sourceType: 'upload',
            isImageBroken: false
          }
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setImageError(true);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  }, [node.id, node.data, onImageUpload, onUpdate]);

  const handleUrlSubmit = useCallback(() => {
    const url = urlValue.trim();
    if (url && onImageUrlSet) {
      onImageUrlSet(node.id, url);
      
      if (onUpdate) {
        onUpdate(node.id, {
          data: {
            ...node.data,
            src: url,
            sourceType: 'url',
            isImageBroken: false
          }
        });
      }
    }
    setShowUrlInput(false);
    setUrlValue('');
  }, [urlValue, node.id, node.data, onImageUrlSet, onUpdate]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowUrlInput(false);
      setUrlValue('');
    }
  }, [handleUrlSubmit]);

  const handleLabelSubmit = useCallback(() => {
    if (onUpdate) {
      const sanitizedLabel = sanitizeText(editLabelValue.trim() || 'Image');
      onUpdate(node.id, {
        data: { ...node.data, label: sanitizedLabel }
      });
    }
    setIsEditingLabel(false);
  }, [editLabelValue, node.id, node.data, onUpdate]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLabelSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditLabelValue(node.data.label || '');
      setIsEditingLabel(false);
    }
  }, [handleLabelSubmit, node.data.label]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoaded(false);
    setImageError(true);
    
    // Mark image as broken in node data
    if (onUpdate) {
      onUpdate(node.id, {
        data: { ...node.data, isImageBroken: true }
      });
    }
  }, [node.id, node.data, onUpdate]);

  const handleResize = useCallback((width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height }
      });
    }
  }, [node.id, node.style, onUpdate]);

  // Get colors with fallbacks - memoized for performance
  const colors = useMemo(() => {
    const nodeColors = node.data.colors || {};
    return {
      headerBg: nodeColors.headerBackground || '#f8fafc',
      bodyBg: nodeColors.bodyBackground || '#ffffff',
      borderColor: nodeColors.borderColor || '#e2e8f0',
      headerTextColor: nodeColors.headerTextColor || '#1e293b',
      bodyTextColor: nodeColors.bodyTextColor || '#64748b'
    };
  }, [node.data.colors]);

  // Get CSS classes for node styles
  const styleClasses = useMemo(() => {
    return getNodeStyleClasses({
      headerBackground: colors.headerBg,
      bodyBackground: colors.bodyBg,
      borderColor: colors.borderColor,
      headerTextColor: colors.headerTextColor,
      bodyTextColor: colors.bodyTextColor
    });
  }, [colors]);

  const nodeWidth = node.style?.width || node.width || 250;
  const nodeHeight = node.style?.height || node.height || 200;

  // Get dynamic class for node positioning and dimensions
  const nodePositionClass = useMemo(() => {
    return getDynamicClassName({
      position: 'absolute',
      left: `${node.position.x}px`,
      top: `${node.position.y}px`,
      width: `${nodeWidth}px`,
      height: `${nodeHeight}px`,
      zIndex: node.zIndex || 0,
      ...style
    }, `image-node-${node.id}`);
  }, [node.position.x, node.position.y, nodeWidth, nodeHeight, node.zIndex, node.id, style]);

  // Get dynamic class for border color
  const borderClass = useMemo(() => {
    return getDynamicClassName({
      borderColor: colors.borderColor
    }, `image-border-${node.id}`);
  }, [colors.borderColor, node.id]);

  const hasImage = node.data.src && !imageError;
  const isPlaceholder = !hasImage || isUploading;

  return (
    <div
      ref={nodeRef}
      className={cn(
        'kiteframe-node group',
        'border-2 rounded-lg shadow-md transition-all duration-200',
        'hover:shadow-lg cursor-move',
        node.selected ? 'ring-2 ring-blue-500 shadow-lg' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        nodePositionClass,
        borderClass,
        className
      )}
      role="article"
      aria-label={`Image node: ${node.data.label || 'Untitled'}. ${hasImage ? `Image: ${node.data.filename || 'Uploaded image'}` : 'No image uploaded'}`}
      aria-selected={node.selected}
      tabIndex={node.selected ? 0 : -1}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      data-testid={`image-node-${node.id}`}
    >
      {/* Header */}
      <div 
        className={cn(
          "h-8 px-3 flex items-center justify-between rounded-t-md",
          styleClasses.headerClass
        )}
        role="heading"
        aria-level={3}
        onDoubleClick={handleLabelDoubleClick}
      >
        {isEditingLabel ? (
          <input
            ref={labelInputRef}
            type="text"
            value={editLabelValue}
            onChange={(e) => setEditLabelValue(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={handleLabelKeyDown}
            className={cn(
              "bg-transparent border-none outline-none text-sm font-medium w-full",
              getDynamicClassName({ color: colors.headerTextColor }, `label-input-${node.id}`)
            )}
            placeholder="Enter label..."
            aria-label="Image node label"
            data-testid="image-node-label-input"
          />
        ) : (
          <span className="text-sm font-medium truncate">
            {sanitizeText(node.data.label || 'Image')}
          </span>
        )}
        
        <div className="flex items-center gap-1">
          {/* Image status indicator */}
          <div 
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              getDynamicClassName(
                { backgroundColor: hasImage ? '#22c55e' : '#94a3b8' },
                `status-${node.id}-${hasImage}`
              )
            )}
            title={hasImage ? 'Image loaded' : 'No image'}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Body */}
      <div 
        className={cn(
          "flex-1 rounded-b-md overflow-hidden",
          getDynamicClassName(
            { backgroundColor: colors.bodyBg, minHeight: `${nodeHeight - 32}px` },
            `image-body-${node.id}`
          )
        )}
        role="region"
        aria-label="Image content"
      >
        {/* URL Input */}
        {showUrlInput && (
          <div className="p-3 border-b border-gray-200">
            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                placeholder="Enter image URL..."
                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Image URL"
                aria-describedby="url-format-hint"
              />
              <button
                onClick={handleUrlSubmit}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!urlValue.trim()}
                data-testid="button-submit-url"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowUrlInput(false);
                  setUrlValue('');
                }}
                className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                data-testid="button-cancel-url"
              >
                Cancel
              </button>
            </div>
            <span id="url-format-hint" className="sr-only">
              Enter a valid image URL starting with http:// or https://
            </span>
          </div>
        )}

        {/* Image Display */}
        {hasImage && !isUploading ? (
          <div className="relative w-full h-full">
            <img
              src={node.data.src}
              alt={node.data.altText || node.data.label || node.data.filename || 'Image'}
              className="w-full h-full object-cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
              draggable={false}
              aria-describedby={node.data.description ? `${node.id}-description` : undefined}
            />
            {node.data.description && (
              <span id={`${node.id}-description`} className="sr-only">
                {node.data.description}
              </span>
            )}
            {node.data.filename && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {node.data.filename}
              </div>
            )}
          </div>
        ) : (
          /* Placeholder/Upload Area */
          <div 
            className={cn(
              "flex flex-col items-center justify-center h-full p-4 text-center",
              getDynamicClassName(
                { color: colors.bodyTextColor },
                `placeholder-text-${node.id}`
              )
            )}
          >
            {isUploading ? (
              <>
                <Upload className="w-8 h-8 mb-2 animate-pulse" />
                <span className="text-sm">Uploading...</span>
              </>
            ) : imageError ? (
              <>
                <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                <span className="text-sm text-red-600">Failed to load image</span>
                <button
                  onClick={handleUploadClick}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                  aria-label="Try uploading image again"
                >
                  Try uploading again
                </button>
              </>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 mb-2 opacity-60" />
                <span className="text-sm opacity-80 mb-2">
                  {node.data.displayText || 'No image'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleUploadClick}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    disabled={isUploading}
                    aria-label="Upload image from your computer"
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    aria-label="Add image from URL"
                  >
                    URL
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload image file"
      />

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={{
            ...node,
            width: nodeWidth,
            height: nodeHeight
          }}
          scale={viewport?.zoom || 1}
          onHandleConnect={useCallback((pos: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => {
            console.log('Handle connect:', pos, e);
          }, [])}
        />
      )}

      {/* Resize Handle */}
      {showResizeHandle && node.resizable !== false && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={200}
          minHeight={150}
          viewport={viewport}
        />
      )}
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const ImageNode = React.memo(ImageNodeComponent);

// Default props for creating an image node
export const createImageNode = (
  id: string, 
  position: { x: number; y: number },
  data: Partial<ImageNodeData> = {}
): Node & { data: ImageNodeData } => ({
  id,
  type: 'image',
  position,
  data: {
    label: data.label || 'Image',
    description: data.description || '',
    src: data.src || '',
    filename: data.filename || '',
    sourceType: data.sourceType || 'upload',
    isImageBroken: data.isImageBroken || false,
    displayText: data.displayText || 'Double-click to upload',
    colors: data.colors || {}
  },
  width: 250,
  height: 200,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true
});