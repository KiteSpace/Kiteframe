import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Palette, Upload, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { Node, ImageNodeData } from '../../types';

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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImageUpload) return;

    if (!file.type.startsWith('image/')) {
      console.error('Please select an image file');
      return;
    }

    if (file.size > 10485760) {
      console.error('File size must be less than 10MB');
      return;
    }

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
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleUrlSubmit = () => {
    const url = urlValue.trim();
    if (url && onImageUrlSet) {
      onImageUrlSet(node.id, url);
      handleUpdate({
        data: {
          ...node.data,
          src: url,
          sourceType: 'url',
          isImageBroken: false
        }
      });
    }
    setShowUrlInput(false);
    setUrlValue('');
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
              data: { ...node.data, imageSize: e.target.value as 'fill' | 'fit' | 'contain' }
            })}
            className="w-full text-sm border border-input bg-background px-3 py-2 rounded-md"
            data-testid="image-size-select"
          >
            <option value="contain">Contain - Show full image within bounds</option>
            <option value="fill">Fill - Fill node completely (may crop)</option>
            <option value="fit">Fit - Scale down to fit if needed</option>
          </select>
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
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-xs"
          >
            <Upload className="w-3 h-3 mr-1" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            URL
          </Button>
        </div>

        {/* URL Input */}
        {showUrlInput && (
          <div className="space-y-2">
            <Input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUrlSubmit();
                } else if (e.key === 'Escape') {
                  setShowUrlInput(false);
                  setUrlValue('');
                }
              }}
              placeholder="Enter image URL..."
              className="text-xs"
              data-testid="image-url-input"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUrlSubmit} className="text-xs">
                Set URL
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setShowUrlInput(false);
                  setUrlValue('');
                }}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
};