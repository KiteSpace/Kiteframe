import { useState } from 'react';
import { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { X, Palette, Square, Circle, Triangle, Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { EdgeProperties } from '@/components/shared/EdgeProperties';
import { FigmaStyleColorPicker } from '@/components/FigmaStyleColorPicker';

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
      className="absolute z-50 top-32 left-16 w-72 bg-card border border-border rounded-md shadow-lg"
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
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
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

            {/* Node Color Customization */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <Label className="text-xs font-semibold">Node Colors</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Header Background */}
                <FigmaStyleColorPicker
                  fillColor={selectedNode.data?.colors?.headerBackground || selectedNode.data?.color || '#f8fafc'}
                  onFillColorChange={(color) => {
                    const newHeaderTextColor = getAppropriateTextColor(color);
                    onNodeUpdate?.(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        colors: {
                          ...selectedNode.data?.colors,
                          headerBackground: color,
                          headerTextColor: newHeaderTextColor
                        }
                      }
                    });
                  }}
                  showFill={true}
                  showStroke={false}
                  label="Header Background"
                  testIdScope="node-header-bg"
                  className="space-y-1"
                />

                {/* Body Background */}
                <FigmaStyleColorPicker
                  fillColor={selectedNode.data?.colors?.bodyBackground || selectedNode.data?.color || '#ffffff'}
                  onFillColorChange={(color) => {
                    const newBodyTextColor = getAppropriateTextColor(color);
                    onNodeUpdate?.(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        colors: {
                          ...selectedNode.data?.colors,
                          bodyBackground: color,
                          bodyTextColor: newBodyTextColor
                        }
                      }
                    });
                  }}
                  showFill={true}
                  showStroke={false}
                  label="Body Background"
                  testIdScope="node-body-bg"
                  className="space-y-1"
                />

                {/* Border Color */}
                <FigmaStyleColorPicker
                  fillColor={selectedNode.data?.colors?.borderColor || selectedNode.data?.borderColor || '#e2e8f0'}
                  onFillColorChange={(color) => onNodeUpdate?.(selectedNode.id, {
                    data: {
                      ...selectedNode.data,
                      colors: {
                        ...selectedNode.data?.colors,
                        borderColor: color
                      }
                    }
                  })}
                  showFill={true}
                  showStroke={false}
                  label="Border Color"
                  testIdScope="node-border"
                  className="space-y-1"
                />

                {/* Header Text */}
                <FigmaStyleColorPicker
                  fillColor={selectedNode.data?.colors?.headerTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#0f172a'}
                  onFillColorChange={(color) => onNodeUpdate?.(selectedNode.id, {
                    data: {
                      ...selectedNode.data,
                      colors: {
                        ...selectedNode.data?.colors,
                        headerTextColor: color
                      }
                    }
                  })}
                  showFill={true}
                  showStroke={false}
                  label="Header Text"
                  testIdScope="node-header-text"
                  className="space-y-1"
                />
              </div>

              {/* Body Text - Full Width */}
              <FigmaStyleColorPicker
                fillColor={selectedNode.data?.colors?.bodyTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#475569'}
                onFillColorChange={(color) => onNodeUpdate?.(selectedNode.id, {
                  data: {
                    ...selectedNode.data,
                    colors: {
                      ...selectedNode.data?.colors,
                      bodyTextColor: color
                    }
                  }
                })}
                showFill={true}
                showStroke={false}
                label="Body Text"
                testIdScope="node-body-text"
                className="space-y-1"
              />
            </div>

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
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Text Content</Label>
                  <Input
                    value={selectedCanvasObject.data?.text || ''}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      data: {
                        ...selectedCanvasObject.data,
                        text: e.target.value
                      }
                    })}
                    className="text-sm"
                    placeholder="Text content..."
                    data-testid="text-content-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Font Size</Label>
                  <Input
                    type="number"
                    value={selectedCanvasObject.data?.fontSize || 16}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      data: {
                        ...selectedCanvasObject.data,
                        fontSize: Number(e.target.value)
                      }
                    })}
                    className="text-sm"
                    min="8"
                    max="72"
                    data-testid="font-size-input"
                  />
                </div>
              </>
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

                <FigmaStyleColorPicker
                  fillColor={selectedCanvasObject.data?.backgroundColor || '#fef3c7'}
                  onFillColorChange={(color) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      backgroundColor: color
                    }
                  })}
                  showFill={true}
                  showStroke={false}
                  label="Background"
                  testIdScope="sticky-bg"
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

                <FigmaStyleColorPicker
                  fillColor={selectedCanvasObject.data?.fillColor || '#3b82f6'}
                  strokeColor={selectedCanvasObject.data?.strokeColor || '#1e40af'}
                  onFillColorChange={(color) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      fillColor: color
                    }
                  })}
                  onStrokeColorChange={(color) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                    data: {
                      ...selectedCanvasObject.data,
                      strokeColor: color
                    }
                  })}
                  showFill={true}
                  showStroke={true}
                  label="Shape Colors"
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