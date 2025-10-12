import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Palette } from 'lucide-react';
import type { Node, BasicNodeData } from '../../types';

interface BasicNodePropertiesProps {
  node: Node & { data: BasicNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
}

export const BasicNodeProperties: React.FC<BasicNodePropertiesProps> = ({
  node,
  onUpdate
}) => {
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

  const colors = node.data.colors || {};

  return (
    <>
      {/* Node Type */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Node Type</Label>
        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          Basic Node
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
          placeholder="Node label..."
          data-testid="basic-node-label-input"
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
          placeholder="Node description..."
          data-testid="basic-node-description-input"
        />
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
                  data-testid="header-bg-color"
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
                data-testid="header-bg-hex"
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
                  data-testid="body-bg-color"
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
                data-testid="body-bg-hex"
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
              data-testid="basic-node-x-input"
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
              data-testid="basic-node-y-input"
            />
          </div>
        </div>
      </div>
    </>
  );
};