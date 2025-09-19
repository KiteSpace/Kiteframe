import { useState } from 'react';
import { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { X, Palette, Square, Circle, Triangle, Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { EdgeProperties } from '@/components/shared/EdgeProperties';
import FigmaStyleColorPicker from '@/components/FigmaStyleColorPicker';
import { TabbedColorPicker, ColorProperty } from '@/components/TabbedColorPicker';
import { ColorPickerControl } from '@/lib/kiteframe/components/styling/ColorPickerControl';
import { DropdownControl } from '@/lib/kiteframe/components/styling/DropdownControl';
import FillStrokeColorPicker from '@/components/FillStrokeColorPicker';
import { TypographyPanel } from '@/components/TypographyPanel';

interface PropertiesCardProps {
  selectedNode?: Node;
  selectedEdge?: Edge;
  selectedCanvasObject?: CanvasObject;
  // Additional props to detect mixed selections
  selectedNodeIds?: string[];
  selectedCanvasObjectIds?: string[];
  nodes?: Node[]; // For EdgeProperties to lookup node labels
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onCanvasObjectUpdate?: (objectId: string, updates: Partial<any>) => void;
  onDeselect: () => void;
}

// Helper function to create color properties for different node types
function createNodeColorProperties(selectedNode: Node): ColorProperty[] {
  // Type-aware property mapping based on node type
  const commonProperties: ColorProperty[] = [
    {
      key: 'border',
      label: 'Border',
      value: selectedNode.data?.colors?.borderColor || selectedNode.data?.borderColor || '#e2e8f0',
      opacity: selectedNode.data?.colors?.borderOpacity ?? 100,
      hasOpacity: true,
      type: 'stroke' as const
    }
  ];

  // Different node types have different color properties
  switch (selectedNode.type) {
    case 'input':
    case 'process':
    case 'condition':
    case 'output':
    case 'ai':
      // Basic nodes with header and body
      return [
        {
          key: 'headerBg',
          label: 'Header BG',
          value: selectedNode.data?.colors?.headerBackground || selectedNode.data?.color || '#f8fafc',
          opacity: selectedNode.data?.colors?.headerBackgroundOpacity ?? 100,
          hasOpacity: true,
          type: 'fill' as const
        },
        {
          key: 'bodyBg', 
          label: 'Body BG',
          value: selectedNode.data?.colors?.bodyBackground || selectedNode.data?.color || '#ffffff',
          opacity: selectedNode.data?.colors?.bodyBackgroundOpacity ?? 100,
          hasOpacity: true,
          type: 'fill' as const
        },
        ...commonProperties,
        {
          key: 'headerText',
          label: 'Header Text',
          value: selectedNode.data?.colors?.headerTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#0f172a',
          opacity: 100,
          hasOpacity: false,
          type: 'fill' as const
        },
        {
          key: 'bodyText',
          label: 'Body Text', 
          value: selectedNode.data?.colors?.bodyTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#475569',
          opacity: 100,
          hasOpacity: false,
          type: 'fill' as const
        }
      ];
      
    case 'image':
      // Image nodes only have border color
      return [
        {
          key: 'border',
          label: 'Border',
          value: selectedNode.data?.colors?.borderColor || selectedNode.data?.borderColor || '#e2e8f0',
          opacity: selectedNode.data?.colors?.borderOpacity ?? 100,
          hasOpacity: true,
          type: 'stroke' as const
        }
      ];
      
    default:
      // Fallback for unknown node types - basic node properties
      return [
        {
          key: 'headerBg',
          label: 'Header BG',
          value: selectedNode.data?.colors?.headerBackground || selectedNode.data?.color || '#f8fafc',
          opacity: selectedNode.data?.colors?.headerBackgroundOpacity ?? 100,
          hasOpacity: true,
          type: 'fill' as const
        },
        {
          key: 'bodyBg', 
          label: 'Body BG',
          value: selectedNode.data?.colors?.bodyBackground || selectedNode.data?.color || '#ffffff',
          opacity: selectedNode.data?.colors?.bodyBackgroundOpacity ?? 100,
          hasOpacity: true,
          type: 'fill' as const
        },
        ...commonProperties
      ];
  }
}

// Helper function to handle color updates for nodes
function handleNodeColorUpdate(
  propertyKey: string,
  color: string,
  selectedNode: Node,
  onNodeUpdate: (nodeId: string, updates: Partial<Node>) => void,
  getAppropriateTextColor: (bgColor: string) => string
) {
  const updates: Partial<Node> = {
    data: {
      ...selectedNode.data,
      colors: {
        ...selectedNode.data?.colors
      }
    }
  };

  switch (propertyKey) {
    case 'headerBg':
      updates.data!.colors!.headerBackground = color;
      updates.data!.colors!.headerTextColor = getAppropriateTextColor(color);
      break;
    case 'bodyBg':
      updates.data!.colors!.bodyBackground = color;
      updates.data!.colors!.bodyTextColor = getAppropriateTextColor(color);
      break;
    case 'border':
      updates.data!.colors!.borderColor = color;
      break;
    case 'headerText':
      updates.data!.colors!.headerTextColor = color;
      break;
    case 'bodyText':
      updates.data!.colors!.bodyTextColor = color;
      break;
  }

  onNodeUpdate(selectedNode.id, updates);
}

// Helper function to handle opacity updates for nodes
function handleNodeOpacityUpdate(
  propertyKey: string,
  opacity: number,
  selectedNode: Node,
  onNodeUpdate: (nodeId: string, updates: Partial<Node>) => void
) {
  const updates: Partial<Node> = {
    data: {
      ...selectedNode.data,
      colors: {
        ...selectedNode.data?.colors
      }
    }
  };

  switch (propertyKey) {
    case 'headerBg':
      updates.data!.colors!.headerBackgroundOpacity = opacity;
      break;
    case 'bodyBg':
      updates.data!.colors!.bodyBackgroundOpacity = opacity;
      break;
    case 'border':
      updates.data!.colors!.borderOpacity = opacity;
      break;
  }

  onNodeUpdate(selectedNode.id, updates);
}

export function PropertiesCard({ 
  selectedNode, 
  selectedEdge, 
  selectedCanvasObject,
  selectedNodeIds = [],
  selectedCanvasObjectIds = [],
  nodes = [],
  onNodeUpdate,
  onEdgeUpdate,
  onCanvasObjectUpdate,
  onDeselect 
}: PropertiesCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Helper function to determine if a color is light or dark
  const isLightColor = (color: string): boolean => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance using the formula from WCAG guidelines
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  // Helper function to get appropriate text color based on background
  const getAppropriateTextColor = (backgroundColor: string): string => {
    return isLightColor(backgroundColor) ? '#0f172a' : '#ffffff';
  };

  // Check for mixed selection (both nodes and canvas objects selected)
  const hasMixedSelection = selectedNodeIds.length > 0 && selectedCanvasObjectIds.length > 0;
  
  // Don't render if nothing is selected
  if (!selectedNode && !selectedEdge && !selectedCanvasObject) {
    return null;
  }
  
  // Don't render if there's a mixed selection (nodes + canvas objects)
  if (hasMixedSelection) {
    console.log('🚫 PropertiesCard: Hidden due to mixed selection', {
      selectedNodeIds: selectedNodeIds.length,
      selectedCanvasObjectIds: selectedCanvasObjectIds.length,
      nodeIds: selectedNodeIds,
      objectIds: selectedCanvasObjectIds
    });
    return null;
  }

  const hasSelection = selectedNode || selectedEdge || selectedCanvasObject;

  return (
    <div 
      className="absolute z-[100] top-32 left-16 w-[360px] bg-card border border-border rounded-md shadow-lg"
      data-testid="properties-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Square className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Properties</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselect}
          className="h-6 w-6 p-0"
          data-testid="close-properties"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 h-[calc(100vh-180px)] overflow-y-auto">
        {/* Node Properties */}
        {selectedNode && (
          <>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Label</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                  data: { ...selectedNode.data, label: e.target.value }
                })}
                className="text-sm"
                placeholder="Node label..."
                data-testid="node-label-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Description</Label>
              <Input
                value={selectedNode.data.description || ''}
                onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                  data: { ...selectedNode.data, description: e.target.value }
                })}
                className="text-sm"
                placeholder="Node description..."
                data-testid="node-description-input"
              />
            </div>

            {/* Node Color Customization - Tabbed Interface */}
            <Separator />
            <TabbedColorPicker
              colorProperties={createNodeColorProperties(selectedNode)}
              onColorChange={(propertyKey, color) => {
                if (onNodeUpdate) {
                  handleNodeColorUpdate(propertyKey, color, selectedNode, onNodeUpdate, getAppropriateTextColor);
                }
              }}
              onOpacityChange={(propertyKey, opacity) => {
                if (onNodeUpdate) {
                  handleNodeOpacityUpdate(propertyKey, opacity, selectedNode, onNodeUpdate);
                }
              }}
              testIdScope="node-colors"
              className="space-y-1"
            />

            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">X Position</Label>
                <Input
                  type="number"
                  value={Math.round(selectedNode.position.x)}
                  onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                    position: { ...selectedNode.position, x: Number(e.target.value) }
                  })}
                  className="text-sm"
                  data-testid="node-x-input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Y Position</Label>
                <Input
                  type="number"
                  value={Math.round(selectedNode.position.y)}
                  onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                    position: { ...selectedNode.position, y: Number(e.target.value) }
                  })}
                  className="text-sm"
                  data-testid="node-y-input"
                />
              </div>
            </div>
          </>
        )}

        {/* Edge Properties */}
        {selectedEdge && onEdgeUpdate && (
          <EdgeProperties
            selectedEdge={selectedEdge}
            onEdgeUpdate={onEdgeUpdate}
            nodes={nodes}
            compact={true}
          />
        )}

        {/* Canvas Object Properties */}
        {selectedCanvasObject && (
          <>
            {/* Text Object Properties */}
            {selectedCanvasObject.type === 'text' && (
              <TypographyPanel
                textContent={selectedCanvasObject.data?.text || ''}
                fontSize={selectedCanvasObject.data?.fontSize || 16}
                fontFamily={selectedCanvasObject.data?.fontFamily || 'Inter'}
                fontWeight={selectedCanvasObject.data?.fontWeight || 'normal'}
                textColor={selectedCanvasObject.data?.textColor || '#000000'}
                textAlign={selectedCanvasObject.data?.textAlign}
                textDecoration={selectedCanvasObject.data?.textDecoration}
                onTextContentChange={(value) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    text: value
                  }
                })}
                onFontSizeChange={(value) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    fontSize: value
                  }
                })}
                onFontFamilyChange={(value) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    fontFamily: value
                  }
                })}
                onFontWeightChange={(value) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    fontWeight: value
                  }
                })}
                onTextColorChange={(color) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    textColor: color
                  }
                })}
                onTextAlignChange={(value) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    textAlign: value
                  }
                })}
                onTextDecorationChange={(value) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                  data: {
                    ...selectedCanvasObject.data,
                    textDecoration: value
                  }
                })}
              />
            )}

            {/* Sticky Note Properties */}
            {selectedCanvasObject.type === 'sticky' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Note Content</Label>
                  <Input
                    value={selectedCanvasObject.data?.text || ''}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      data: {
                        ...selectedCanvasObject.data,
                        text: e.target.value
                      }
                    })}
                    className="text-sm"
                    placeholder="Note content..."
                    data-testid="sticky-content-input"
                  />
                </div>

                <FillStrokeColorPicker
                  fillColor={selectedCanvasObject.data?.backgroundColor || '#fef3c7'}
                  fillOpacity={selectedCanvasObject.data?.backgroundOpacity ?? 100}
                  onFillColorChange={(hex) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      backgroundColor: hex
                    }
                  })}
                  onFillOpacityChange={(val) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      backgroundOpacity: val
                    }
                  })}
                  strokeColor={selectedCanvasObject.data?.borderColor || '#d97706'}
                  strokeOpacity={selectedCanvasObject.data?.borderOpacity ?? 100}
                  onStrokeColorChange={(hex) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      borderColor: hex
                    }
                  })}
                  onStrokeOpacityChange={(val) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      borderOpacity: val
                    }
                  })}
                  testIdScope="sticky-colors"
                />
              </>
            )}

            {/* Shape Properties */}
            {selectedCanvasObject.type === 'shape' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Shape Type</Label>
                  <div className="flex gap-2">
                    {[
                      { type: 'rectangle', icon: Square, color: 'text-blue-500', label: 'Rectangle' },
                      { type: 'circle', icon: Circle, color: 'text-green-500', label: 'Circle' },
                      { type: 'triangle', icon: Triangle, color: 'text-yellow-500', label: 'Triangle' },
                      { type: 'hexagon', icon: Hexagon, color: 'text-purple-500', label: 'Hexagon' },
                    ].map((shapeType) => {
                      const IconComponent = shapeType.icon;
                      const isSelected = selectedCanvasObject.data?.shapeType === shapeType.type;
                      
                      return (
                        <Button
                          key={shapeType.type}
                          variant="outline"
                          size="sm"
                          className={`p-2 h-8 w-8 ${isSelected ? 'bg-accent text-accent-foreground border-accent' : 'hover:bg-accent/50'}`}
                          onClick={() => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                            data: {
                              ...selectedCanvasObject.data,
                              shapeType: shapeType.type
                            }
                          })}
                          data-testid={`shape-type-${shapeType.type}`}
                          title={shapeType.label}
                          aria-pressed={isSelected}
                        >
                          <IconComponent className={`${shapeType.color}`} size={14} />
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <FillStrokeColorPicker
                  fillColor={selectedCanvasObject.data?.fillColor || '#3b82f6'}
                  fillOpacity={selectedCanvasObject.data?.fillOpacity ?? 100}
                  onFillColorChange={(hex) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      fillColor: hex
                    }
                  })}
                  onFillOpacityChange={(val) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      fillOpacity: val
                    }
                  })}
                  strokeColor={selectedCanvasObject.data?.strokeColor || '#1e40af'}
                  strokeOpacity={selectedCanvasObject.data?.strokeOpacity ?? 100}
                  onStrokeColorChange={(hex) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      strokeColor: hex
                    }
                  })}
                  onStrokeOpacityChange={(val) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      strokeOpacity: val
                    }
                  })}
                  testIdScope="shape-colors"
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">X Position</Label>
                <Input
                  type="number"
                  value={Math.round(selectedCanvasObject.position.x)}
                  onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    position: { ...selectedCanvasObject.position, x: Number(e.target.value) }
                  })}
                  className="text-sm"
                  data-testid="object-x-input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Y Position</Label>
                <Input
                  type="number"
                  value={Math.round(selectedCanvasObject.position.y)}
                  onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    position: { ...selectedCanvasObject.position, y: Number(e.target.value) }
                  })}
                  className="text-sm"
                  data-testid="object-y-input"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}