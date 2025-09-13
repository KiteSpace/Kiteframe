import { useState } from 'react';
import { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { X, Edit, Eye, EyeOff, Palette, Type, Move, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface PropertiesCardProps {
  selectedNode?: Node;
  selectedEdge?: Edge;
  selectedCanvasObject?: CanvasObject;
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onCanvasObjectUpdate?: (objectId: string, updates: Partial<any>) => void;
  onDeselect: () => void;
}

export function PropertiesCard({ 
  selectedNode, 
  selectedEdge, 
  selectedCanvasObject,
  onNodeUpdate,
  onEdgeUpdate,
  onCanvasObjectUpdate,
  onDeselect 
}: PropertiesCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Don't render if nothing is selected
  if (!selectedNode && !selectedEdge && !selectedCanvasObject) {
    return null;
  }

  const hasSelection = selectedNode || selectedEdge || selectedCanvasObject;

  return (
    <div 
      className="absolute left-12 top-16 z-50 w-72 bg-card border border-border rounded-md shadow-lg"
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
        {selectedEdge && (
          <>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Edge Type</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                {selectedEdge.type || 'default'}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-medium">Label</Label>
              <Input
                value={selectedEdge.label || ''}
                onChange={(e) => onEdgeUpdate?.(selectedEdge.id, { label: e.target.value })}
                className="text-sm"
                placeholder="Edge label..."
                data-testid="edge-label-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Source → Target</Label>
              <div className="p-2 bg-muted rounded text-sm">
                {selectedEdge.source} → {selectedEdge.target}
              </div>
            </div>
          </>
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