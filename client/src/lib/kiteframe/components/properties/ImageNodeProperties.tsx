import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Palette, Upload, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { Node, ImageNodeData, ImageFit } from '../../types';
import { Switch } from '@/components/ui/switch';
import { Maximize2 } from 'lucide-react';
import { ImageUploadModal } from '../modals/ImageUploadModal';

interface ImageNodePropertiesProps {
  node: Node & { data: ImageNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onImageUpload?: (nodeId: string, file: File) => Promise<string>;
  onImageUrlSet?: (nodeId: string, url: string) => void;
}

export const ImageNodeProperties: React.FC<ImageNodePropertiesProps> = ({
  node,
  onUpdate,
  onImageUpload,
  onImageUrlSet
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingResize, setIsDraggingResize] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Helper function to determine if a color is light or dark
  const isLightColor = (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const getAppropriateTextColor = (backgroundColor: string): string => {
    return isLightColor(backgroundColor) ? '#0f172a' : '#ffffff';
  };

  const handleUpdate = (updates: Partial<Node>) => {
    onUpdate?.(node.id, updates);
  };

  const handleModalImageUpload = async (file: File) => {
    if (!onImageUpload) return '';

    setIsUploading(true);
    try {
      const imageUrl = await onImageUpload(node.id, file);
      handleUpdate({
        data: {
          ...node.data,
          src: imageUrl,
          filename: file.name,
          sourceType: 'upload',
          isImageBroken: false
        }
      });
      return imageUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleModalImageUrl = (url: string) => {
    if (onImageUrlSet) {
      onImageUrlSet(node.id, url);
    }
    handleUpdate({
      data: {
        ...node.data,
        src: url,
        sourceType: 'url',
        isImageBroken: false
      }
    });
  };

  const colors = node.data.colors || {};

  return (
    <>
      {/* Node Type */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Node Type</Label>
        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          Image Node
        </div>
      </div>
      
      {/* Label */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Label</Label>
        <Input
          value={node.data.label || ''}
          onChange={(e) => handleUpdate({
            data: { ...node.data, label: e.target.value }
          })}
          className="text-sm"
          placeholder="Image label..."
          data-testid="image-node-label-input"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Description</Label>
        <Input
          value={node.data.description || ''}
          onChange={(e) => handleUpdate({
            data: { ...node.data, description: e.target.value }
          })}
          className="text-sm"
          placeholder="Image description..."
          data-testid="image-node-description-input"
        />
      </div>

      {/* Image Management */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          <Label className="text-xs font-semibold">Image</Label>
        </div>

        {/* Image Size Mode */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Image Fit</Label>
          <select
            value={node.data.imageSize || 'contain'}
            onChange={(e) => handleUpdate({
              data: { ...node.data, imageSize: e.target.value as ImageFit }
            })}
            className="w-full text-sm border border-input bg-background px-3 py-2 rounded-md"
            data-testid="image-size-select"
          >
            <option value="contain">Contain - Show full image within bounds</option>
            <option value="cover">Cover - Fill node completely (may crop)</option>
            <option value="fill">Fill - Stretch to fill</option>
            <option value="fit">Fit - Scale down to fit if needed</option>
          </select>
        </div>
        
        {/* Auto Height Toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Auto Height</Label>
          <Switch
            checked={node.data.autoHeight !== false}
            onCheckedChange={(checked) => handleUpdate({
              data: { ...node.data, autoHeight: checked }
            })}
            className="scale-75"
            data-testid="image-auto-height-toggle"
          />
        </div>
        
        {/* Size Controls */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Dimensions</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                value={Math.round(node.style?.width || node.width || 200)}
                onChange={(e) => {
                  const width = Math.max(50, parseInt(e.target.value) || 200);
                  handleUpdate({
                    style: { ...node.style, width }
                  });
                }}
                className="text-xs"
                placeholder="Width"
                min={50}
                data-testid="image-width-input"
              />
              <span className="text-xs text-muted-foreground">Width</span>
            </div>
            <div className="flex-1">
              <Input
                type="number"
                value={Math.round(node.style?.height || node.height || 200)}
                onChange={(e) => {
                  const height = Math.max(50, parseInt(e.target.value) || 200);
                  handleUpdate({
                    style: { ...node.style, height },
                    data: { ...node.data, autoHeight: false }
                  });
                }}
                disabled={node.data.autoHeight !== false}
                className="text-xs"
                placeholder="Height"
                min={50}
                data-testid="image-height-input"
              />
              <span className="text-xs text-muted-foreground">Height</span>
            </div>
          </div>
        </div>

        {/* Current Image Info */}
        {node.data.src && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Current Image</Label>
            <div className="p-2 bg-muted rounded text-xs">
              {node.data.filename || 'Image URL'}
              {node.data.isImageBroken && (
                <span className="text-red-500 ml-2">(Broken)</span>
              )}
            </div>
          </div>
        )}

        {/* Image Actions */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowUploadModal(true)}
          disabled={isUploading}
          className="w-full text-xs"
          data-testid="properties-add-image-button"
        >
          <ImageIcon className="w-3 h-3 mr-2" />
          {isUploading ? 'Uploading...' : 'Add Image'}
        </Button>

        {/* Display Text */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Fallback Text</Label>
          <Input
            value={node.data.displayText || ''}
            onChange={(e) => handleUpdate({
              data: { ...node.data, displayText: e.target.value }
            })}
            className="text-sm"
            placeholder="Text when no image..."
            data-testid="image-fallback-text"
          />
        </div>
      </div>

      {/* Color Customization */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          <Label className="text-xs font-semibold">Node Colors</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Header Background */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Header BG</Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={colors.headerBackground || '#f8fafc'}
                  onChange={(e) => {
                    const newHeaderBg = e.target.value;
                    const newHeaderTextColor = getAppropriateTextColor(newHeaderBg);
                    handleUpdate({
                      data: {
                        ...node.data,
                        colors: {
                          ...colors,
                          headerBackground: newHeaderBg,
                          headerTextColor: newHeaderTextColor
                        }
                      }
                    });
                  }}
                  className="w-6 h-6 rounded border border-border cursor-pointer opacity-0 absolute"
                />
                <div 
                  className="w-6 h-6 rounded border border-border cursor-pointer"
                  style={{ backgroundColor: colors.headerBackground || '#f8fafc' }}
                />
              </div>
              <Input
                type="text"
                value={colors.headerBackground || '#f8fafc'}
                onChange={(e) => {
                  const newHeaderBg = e.target.value;
                  const newHeaderTextColor = getAppropriateTextColor(newHeaderBg);
                  handleUpdate({
                    data: {
                      ...node.data,
                      colors: {
                        ...colors,
                        headerBackground: newHeaderBg,
                        headerTextColor: newHeaderTextColor
                      }
                    }
                  });
                }}
                className="flex-1 text-xs"
                placeholder="#f8fafc"
              />
            </div>
          </div>

          {/* Body Background */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Body BG</Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={colors.bodyBackground || '#ffffff'}
                  onChange={(e) => {
                    const newBodyBg = e.target.value;
                    const newBodyTextColor = getAppropriateTextColor(newBodyBg);
                    handleUpdate({
                      data: {
                        ...node.data,
                        colors: {
                          ...colors,
                          bodyBackground: newBodyBg,
                          bodyTextColor: newBodyTextColor
                        }
                      }
                    });
                  }}
                  className="w-6 h-6 rounded border border-border cursor-pointer opacity-0 absolute"
                />
                <div 
                  className="w-6 h-6 rounded border border-border cursor-pointer"
                  style={{ backgroundColor: colors.bodyBackground || '#ffffff' }}
                />
              </div>
              <Input
                type="text"
                value={colors.bodyBackground || '#ffffff'}
                onChange={(e) => {
                  const newBodyBg = e.target.value;
                  const newBodyTextColor = getAppropriateTextColor(newBodyBg);
                  handleUpdate({
                    data: {
                      ...node.data,
                      colors: {
                        ...colors,
                        bodyBackground: newBodyBg,
                        bodyTextColor: newBodyTextColor
                      }
                    }
                  });
                }}
                className="flex-1 text-xs"
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Position */}
      <Separator />
      <div className="space-y-2">
        <Label className="text-xs font-medium">Position</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">X</Label>
            <Input
              type="number"
              value={Math.round(node.position.x)}
              onChange={(e) => handleUpdate({
                position: { ...node.position, x: Number(e.target.value) }
              })}
              className="text-sm"
              data-testid="image-node-x-input"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Y</Label>
            <Input
              type="number"
              value={Math.round(node.position.y)}
              onChange={(e) => handleUpdate({
                position: { ...node.position, y: Number(e.target.value) }
              })}
              className="text-sm"
              data-testid="image-node-y-input"
            />
          </div>
        </div>
      </div>

      {/* Image Upload Modal */}
      <ImageUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onImageUpload={handleModalImageUpload}
        onImageUrlSet={handleModalImageUrl}
        isUploading={isUploading}
      />
    </>
  );
};