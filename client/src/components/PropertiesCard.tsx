import { useState } from 'react';
import { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { X, Edit, Eye, EyeOff, Palette, Type, Move, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { EdgeProperties } from '@/components/shared/EdgeProperties';

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
      className="absolute left-[60px] top-[120px] z-[60] w-72 bg-card border border-border rounded-md shadow-lg"
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
              <Label className="text-xs font-medium">Node Type</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                <div className={`w-2 h-2 rounded-full ${selectedNode.data.iconColor || 'bg-gray-500'}`} />
                {selectedNode.type || 'Unknown'}
              </div>
            </div>
            
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
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Header BG</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={selectedNode.data?.colors?.headerBackground || selectedNode.data?.color || '#f8fafc'}
                        onChange={(e) => {
                          const newHeaderBg = e.target.value;
                          const newHeaderTextColor = getAppropriateTextColor(newHeaderBg);
                          onNodeUpdate?.(selectedNode.id, {
                            data: {
                              ...selectedNode.data,
                              colors: {
                                ...selectedNode.data?.colors,
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
                        style={{ backgroundColor: selectedNode.data?.colors?.headerBackground || selectedNode.data?.color || '#f8fafc' }}
                      />
                    </div>
                    <Input
                      type="text"
                      value={selectedNode.data?.colors?.headerBackground || selectedNode.data?.color || '#f8fafc'}
                      onChange={(e) => {
                        const newHeaderBg = e.target.value;
                        const newHeaderTextColor = getAppropriateTextColor(newHeaderBg);
                        onNodeUpdate?.(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            colors: {
                              ...selectedNode.data?.colors,
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
                        value={selectedNode.data?.colors?.bodyBackground || selectedNode.data?.color || '#ffffff'}
                        onChange={(e) => {
                          const newBodyBg = e.target.value;
                          const newBodyTextColor = getAppropriateTextColor(newBodyBg);
                          onNodeUpdate?.(selectedNode.id, {
                            data: {
                              ...selectedNode.data,
                              colors: {
                                ...selectedNode.data?.colors,
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
                        style={{ backgroundColor: selectedNode.data?.colors?.bodyBackground || selectedNode.data?.color || '#ffffff' }}
                      />
                    </div>
                    <Input
                      type="text"
                      value={selectedNode.data?.colors?.bodyBackground || selectedNode.data?.color || '#ffffff'}
                      onChange={(e) => {
                        const newBodyBg = e.target.value;
                        const newBodyTextColor = getAppropriateTextColor(newBodyBg);
                        onNodeUpdate?.(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            colors: {
                              ...selectedNode.data?.colors,
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

                {/* Border Color */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Border</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={selectedNode.data?.colors?.borderColor || selectedNode.data?.borderColor || '#e2e8f0'}
                        onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            colors: {
                              ...selectedNode.data?.colors,
                              borderColor: e.target.value
                            }
                          }
                        })}
                        className="w-6 h-6 rounded border border-border cursor-pointer opacity-0 absolute"
                        data-testid="border-color"
                      />
                      <div 
                        className="w-6 h-6 rounded border border-border cursor-pointer"
                        style={{ backgroundColor: selectedNode.data?.colors?.borderColor || selectedNode.data?.borderColor || '#e2e8f0' }}
                      />
                    </div>
                    <Input
                      type="text"
                      value={selectedNode.data?.colors?.borderColor || selectedNode.data?.borderColor || '#e2e8f0'}
                      onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                        data: {
                          ...selectedNode.data,
                          colors: {
                            ...selectedNode.data?.colors,
                            borderColor: e.target.value
                          }
                        }
                      })}
                      className="flex-1 text-xs"
                      placeholder="#e2e8f0"
                      data-testid="border-hex"
                    />
                  </div>
                </div>

                {/* Header Text */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Header Text</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={selectedNode.data?.colors?.headerTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#0f172a'}
                        onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            colors: {
                              ...selectedNode.data?.colors,
                              headerTextColor: e.target.value
                            }
                          }
                        })}
                        className="w-6 h-6 rounded border border-border cursor-pointer opacity-0 absolute"
                        data-testid="header-text-color"
                      />
                      <div 
                        className="w-6 h-6 rounded border border-border cursor-pointer"
                        style={{ backgroundColor: selectedNode.data?.colors?.headerTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#0f172a' }}
                      />
                    </div>
                    <Input
                      type="text"
                      value={selectedNode.data?.colors?.headerTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#0f172a'}
                      onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                        data: {
                          ...selectedNode.data,
                          colors: {
                            ...selectedNode.data?.colors,
                            headerTextColor: e.target.value
                          }
                        }
                      })}
                      className="flex-1 text-xs"
                      placeholder="#0f172a"
                      data-testid="header-text-hex"
                    />
                  </div>
                </div>
              </div>

              {/* Body Text - Full Width */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Body Text</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={selectedNode.data?.colors?.bodyTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#475569'}
                      onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                        data: {
                          ...selectedNode.data,
                          colors: {
                            ...selectedNode.data?.colors,
                            bodyTextColor: e.target.value
                          }
                        }
                      })}
                      className="w-6 h-6 rounded border border-border cursor-pointer opacity-0 absolute"
                      data-testid="body-text-color"
                    />
                    <div 
                      className="w-6 h-6 rounded border border-border cursor-pointer"
                      style={{ backgroundColor: selectedNode.data?.colors?.bodyTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#475569' }}
                    />
                  </div>
                  <Input
                    type="text"
                    value={selectedNode.data?.colors?.bodyTextColor || selectedNode.data?.colors?.textColor || selectedNode.data?.textColor || '#475569'}
                    onChange={(e) => onNodeUpdate?.(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        colors: {
                          ...selectedNode.data?.colors,
                          bodyTextColor: e.target.value
                        }
                      }
                    })}
                    className="flex-1 text-xs"
                    placeholder="#475569"
                    data-testid="body-text-hex"
                  />
                </div>
              </div>
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
            <div className="space-y-2">
              <Label className="text-xs font-medium">Object Type</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                {selectedCanvasObject.type}
              </div>
            </div>

            {/* Text Object Properties */}
            {selectedCanvasObject.type === 'text' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Text Content</Label>
                  <Input
                    value={selectedCanvasObject.data?.text || ''}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      text: e.target.value
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
                      fontSize: Number(e.target.value)
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
                      text: e.target.value
                    })}
                    className="text-sm"
                    placeholder="Note content..."
                    data-testid="sticky-content-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Background Color</Label>
                  <Input
                    type="color"
                    value={selectedCanvasObject.data?.backgroundColor || '#fef3c7'}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      backgroundColor: e.target.value
                    })}
                    className="text-sm h-8"
                    data-testid="sticky-bg-color-input"
                  />
                </div>
              </>
            )}

            {/* Shape Properties */}
            {selectedCanvasObject.type === 'shape' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Shape Type</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    {selectedCanvasObject.data?.shapeType || 'rectangle'}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Fill Color</Label>
                  <Input
                    type="color"
                    value={selectedCanvasObject.data?.fillColor || '#3b82f6'}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      fillColor: e.target.value
                    })}
                    className="text-sm h-8"
                    data-testid="shape-fill-color-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Stroke Color</Label>
                  <Input
                    type="color"
                    value={selectedCanvasObject.data?.strokeColor || '#1e40af'}
                    onChange={(e) => onCanvasObjectUpdate?.(selectedCanvasObject.id, {
                      strokeColor: e.target.value
                    })}
                    className="text-sm h-8"
                    data-testid="shape-stroke-color-input"
                  />
                </div>
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