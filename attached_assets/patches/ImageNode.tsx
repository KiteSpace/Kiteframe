/* src/components/nodes/ImageNode.tsx (patched) */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import { Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
import type { Node, ImageNodeData, ImageNodeComponentProps, ImageFit } from '../types';
import { getDynamicClassName, getNodeStyleClasses } from '../utils/styles';
import { sanitizeText } from '../utils/validation';
import { ImageUploadModal } from './modals/ImageUploadModal';
import { toPxNumber } from '@/src/utils/size';

const HEADER_H = 32; // matches h-8

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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(node.data.label || '');

  const nodeRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  const handleAddImageClick = useCallback(() => setShowUploadModal(true), []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.data.src) handleAddImageClick();
    onDoubleClick?.(e);
  }, [node.data.src, handleAddImageClick, onDoubleClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, [contenteditable="true"]');
    if (isInteractiveElement) return;
    e.stopPropagation();
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleModalImageUpload = useCallback(async (file: File) => {
    if (!onImageUpload) return '';
    setIsUploading(true);
    setImageError(false);
    try {
      const imageUrl = await onImageUpload(node.id, file);
      onUpdate?.(node.id, {
        data: {
          ...node.data,
          src: imageUrl,
          filename: file.name,
          sourceType: 'upload',
          isImageBroken: false,
          naturalWidth: undefined,
          naturalHeight: undefined
        }
      });
      return imageUrl;
    } catch (err) {
      console.error('Upload failed:', err);
      setImageError(true);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [node.id, node.data, onImageUpload, onUpdate]);

  const handleModalImageUrl = useCallback((url: string) => {
    onImageUrlSet?.(node.id, url);
    onUpdate?.(node.id, {
      data: { ...node.data, src: url, sourceType: 'url', isImageBroken: false }
    });
  }, [node.id, node.data, onImageUrlSet, onUpdate]);

  const handleLabelSubmit = useCallback(() => {
    const sanitizedLabel = sanitizeText(editLabelValue.trim() || 'Image');
    onUpdate?.(node.id, { data: { ...node.data, label: sanitizedLabel } });
    setIsEditingLabel(false);
  }, [editLabelValue, node.id, node.data, onUpdate]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleLabelSubmit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditLabelValue(node.data.label || ''); setIsEditingLabel(false); }
  }, [handleLabelSubmit, node.data.label]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
    if (!imgRef.current || !onUpdate) return;

    const naturalWidth = imgRef.current.naturalWidth;
    const naturalHeight = imgRef.current.naturalHeight;

    const updates: any = {
      data: { ...node.data, naturalWidth, naturalHeight }
    };

    if (node.data.autoHeight !== false && naturalWidth > 0) {
      const nodeWidthNum = toPxNumber(node.style?.width ?? node.width, 200);
      const imageSize: ImageFit | undefined = (node.data.imageSize as ImageFit) || 'contain';
      const aspectRatio = naturalHeight / naturalWidth;
      if (imageSize === 'contain') {
        const imageHeight = Math.round(nodeWidthNum * aspectRatio);
        const totalNodeHeight = Math.max(100, imageHeight + HEADER_H);
        updates.style = { ...node.style, height: totalNodeHeight };
      } else if (imageSize === 'cover' || imageSize === 'fill' || imageSize === 'fit') {
        const computedHeight = Math.max(100, Math.round(nodeWidthNum * aspectRatio));
        updates.style = { ...node.style, height: computedHeight };
      }
    }

    updates.data.isImageBroken = false;

    onUpdate(node.id, updates);
  }, [node.id, node.data, node.style, node.width, onUpdate]);

  const handleImageError = useCallback(() => {
    setImageLoaded(false);
    setImageError(true);
    onUpdate?.(node.id, { data: { ...node.data, isImageBroken: true } });
  }, [node.id, node.data, onUpdate]);

  const handleResize = useCallback((width: number, height: number) => {
    if (!onUpdate) return;
    let finalHeight = height;
    if (node.data.autoHeight !== false && node.data.naturalWidth && node.data.naturalHeight) {
      const imageSize = node.data.imageSize || 'contain';
      const aspectRatio = node.data.naturalHeight / node.data.naturalWidth;
      if (imageSize === 'contain') {
        const imageHeight = Math.round(width * aspectRatio);
        finalHeight = Math.max(100, imageHeight + HEADER_H);
      } else if (imageSize === 'cover' || imageSize === 'fill' || imageSize === 'fit') {
        finalHeight = Math.max(100, Math.round(width * aspectRatio));
      }
    }
    onUpdate(node.id, { style: { ...node.style, width, height: finalHeight } });
  }, [node.id, node.style, node.data, onUpdate]);

  const nodeWidth = toPxNumber(node.style?.width ?? node.width, 250);
  const nodeHeight = toPxNumber(node.style?.height ?? node.height, 200);

  useEffect(() => {
    if (!node.data.src || !node.data.naturalWidth || !node.data.naturalHeight || node.data.autoHeight === false) return;

    const imageSize = node.data.imageSize || 'contain';
    const aspectRatio = node.data.naturalHeight / node.data.naturalWidth;

    let computedHeight: number;
    if (imageSize === 'contain') {
      const imageHeight = Math.round(nodeWidth * aspectRatio);
      computedHeight = Math.max(100, imageHeight + HEADER_H);
    } else {
      computedHeight = Math.max(100, Math.round(nodeWidth * aspectRatio));
    }

    const currentHeight = toPxNumber(node.style?.height ?? node.height, 200);
    if (Math.abs(currentHeight - computedHeight) > 1) {
      onUpdate?.(node.id, { style: { ...node.style, height: computedHeight } });
    }
  }, [nodeWidth, node.data.src, node.data.imageSize, node.data.naturalWidth, node.data.naturalHeight, node.data.autoHeight, node.style, node.height, node.id, onUpdate]);

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

  const styleClasses = useMemo(() => {
    return getNodeStyleClasses({
      headerBackground: colors.headerBg,
      bodyBackground: colors.bodyBg,
      borderColor: colors.borderColor,
      headerTextColor: colors.headerTextColor,
      bodyTextColor: colors.bodyTextColor
    });
  }, [colors]);

  const imageStyle = useMemo(() => {
    const imageSize = node.data.imageSize || 'contain';
    switch (imageSize) {
      case 'cover':
        return { objectFit: 'cover' as const, width: '100%', height: '100%' };
      case 'fill':
        return { objectFit: 'fill' as const, width: '100%', height: '100%' };
      case 'fit':
        return { objectFit: 'scale-down' as const, width: '100%', height: '100%' };
      case 'contain':
      default:
        return { width: '100%', height: 'auto', maxWidth: '100%' };
    }
  }, [node.data.imageSize]);

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

  const borderClass = useMemo(() => {
    return getDynamicClassName({ borderColor: colors.borderColor }, `image-border-${node.id}`);
  }, [colors.borderColor, node.id]);

  const hasImage = node.data.src && !imageError;

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
      <div
        className={cn('h-8 px-3 flex items-center justify-between rounded-t-md', styleClasses.headerClass)}
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
            className={cn('bg-transparent border-none outline-none text-sm font-medium w-full',
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
          <div
            className={cn('w-2 h-2 rounded-full flex-shrink-0',
              getDynamicClassName({ backgroundColor: hasImage ? '#22c55e' : '#94a3b8' }, `status-${node.id}-${hasImage}`)
            )}
            title={hasImage ? 'Image loaded' : 'No image'}
            aria-hidden="true"
          />
        </div>
      </div>

      <div
        className={cn('flex-1 rounded-b-md overflow-hidden',
          getDynamicClassName({ backgroundColor: colors.bodyBg }, `image-body-${node.id}`)
        )}
        role="region"
        aria-label="Image content"
      >
        {hasImage && !isUploading ? (
          <div className="relative w-full">
            <img
              ref={imgRef}
              src={node.data.src}
              alt={node.data.altText || node.data.label || node.data.filename || 'Image'}
              className="block select-none"
              style={{ ...imageStyle, pointerEvents: 'none' }}  /* keep interactions on container */
              onLoad={handleImageLoad}
              onError={handleImageError}
              draggable={false}
              aria-describedby={node.data.description ? `${node.id}-description` : undefined}
            />
            {node.data.description && (
              <span id={`${node.id}-description`} className="sr-only">{node.data.description}</span>
            )}
            {node.data.filename && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {node.data.filename}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => !isUploading && handleAddImageClick()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (isUploading) return;
              if (e.key === 'Enter' || e.key === ' ') handleAddImageClick();
            }}
            className={cn(
              'flex flex-col items-center justify-center h-full p-4 text-center cursor-pointer rounded-md hover:bg-slate-50',
              getDynamicClassName({ color: colors.bodyTextColor }, `placeholder-text-${node.id}`)
            )}
            data-testid="placeholder-add-image"
            aria-label="Add image to node"
          >
            <ImageIcon className="w-8 h-8 mb-2 opacity-60" />
            <span className="text-sm opacity-80 mb-2">
              {node.data.displayText || 'No image'}
            </span>
            <span className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded">
              <ImageIcon className="w-4 h-4 mr-2 inline" />
              Add Image
            </span>
          </div>
        )}
      </div>

      {showHandles && (
        <NodeHandles
          node={{ ...node, width: nodeWidth, height: nodeHeight }}
          scale={viewport?.zoom || 1}
          onHandleConnect={useCallback((pos: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => {
            // canvas should provide the same handler as for basic nodes
            // ensure it converts client->world and sets connecting state
            // this wrapper remains for parity with other nodes
          }, [])}
        />
      )}

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

      <ImageUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onImageUpload={handleModalImageUpload}
        onImageUrlSet={handleModalImageUrl}
        isUploading={isUploading}
      />
    </div>
  );
};

export const ImageNode = React.memo(ImageNodeComponent);

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
    colors: data.colors || {},
    // imageSize: data.imageSize || 'contain',
    // autoHeight: data.autoHeight ?? true,
  },
  width: 250,
  height: 200,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true
});
