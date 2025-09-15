import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import { Upload, Image as ImageIcon, ExternalLink, AlertCircle } from 'lucide-react';
import type { Node, ImageNodeData, ImageNodeComponentProps } from '../types';


export const ImageNode: React.FC<ImageNodeComponentProps> = ({
  node,
  onUpdate,
  onImageUpload,
  onImageUrlSet,
  onDoubleClick,
  className,
  style,
  showHandles = true,
  showResizeHandle = true
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Focus URL input when shown
  useEffect(() => {
    if (showUrlInput && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [showUrlInput]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.data.src) {
      // If no image, trigger upload
      handleUploadClick();
    }
    onDoubleClick?.(e);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleUrlSubmit = () => {
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
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowUrlInput(false);
      setUrlValue('');
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
    
    // Mark image as broken in node data
    if (onUpdate) {
      onUpdate(node.id, {
        data: { ...node.data, isImageBroken: true }
      });
    }
  };

  const handleResize = (width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height }
      });
    }
  };

  // Get colors with fallbacks
  const colors = node.data.colors || {};
  const headerBg = colors.headerBackground || '#f8fafc';
  const bodyBg = colors.bodyBackground || '#ffffff';
  const borderColor = colors.borderColor || '#e2e8f0';
  const headerTextColor = colors.headerTextColor || '#1e293b';
  const bodyTextColor = colors.bodyTextColor || '#64748b';

  const nodeWidth = node.style?.width || node.width || 250;
  const nodeHeight = node.style?.height || node.height || 200;

  const nodeStyles: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: nodeWidth,
    height: nodeHeight,
    zIndex: node.zIndex || 0,
    ...style
  };

  const hasImage = node.data.src && !imageError;
  const isPlaceholder = !hasImage || isUploading;

  return (
    <div
      ref={nodeRef}
      className={cn(
        'kiteframe-node group',
        'border-2 rounded-lg shadow-md transition-all duration-200',
        'hover:shadow-lg',
        node.selected ? 'ring-2 ring-blue-500 shadow-lg' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        isPlaceholder ? 'cursor-pointer' : 'cursor-move',
        className
      )}
      style={{
        ...nodeStyles,
        borderColor,
      }}
      onDoubleClick={handleDoubleClick}
      data-testid={`image-node-${node.id}`}
    >
      {/* Header */}
      <div 
        className="h-8 px-3 flex items-center justify-between rounded-t-md"
        style={{
          backgroundColor: headerBg,
          color: headerTextColor
        }}
      >
        <span className="text-sm font-medium truncate">
          {node.data.label || 'Image'}
        </span>
        
        <div className="flex items-center gap-1">
          {/* Image status indicator */}
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: hasImage ? '#22c55e' : '#94a3b8'
            }}
            title={hasImage ? 'Image loaded' : 'No image'}
          />
        </div>
      </div>

      {/* Body */}
      <div 
        className="flex-1 rounded-b-md overflow-hidden"
        style={{
          backgroundColor: bodyBg,
          minHeight: nodeHeight - 32
        }}
      >
        {/* URL Input */}
        {showUrlInput && (
          <div className="p-3 border-b border-gray-200">
            <input
              ref={urlInputRef}
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onBlur={handleUrlSubmit}
              onKeyDown={handleUrlKeyDown}
              placeholder="Enter image URL..."
              className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Image Display */}
        {hasImage && !isUploading ? (
          <div className="relative w-full h-full">
            <img
              src={node.data.src}
              alt={node.data.label || 'Image'}
              className="w-full h-full object-cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
              draggable={false}
            />
            {node.data.filename && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {node.data.filename}
              </div>
            )}
          </div>
        ) : (
          /* Placeholder/Upload Area */
          <div 
            className="flex flex-col items-center justify-center h-full p-4 text-center"
            style={{ color: bodyTextColor }}
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
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
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
      />

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={node}
          scale={1}
          onHandleConnect={(pos, e) => {
            console.log('Handle connect:', pos, e);
          }}
        />
      )}

      {/* Resize Handle */}
      {showResizeHandle && node.resizable !== false && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={(width, height, resizeInfo) => handleResize(width, height)}
          minWidth={200}
          minHeight={150}
        />
      )}
    </div>
  );
};

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