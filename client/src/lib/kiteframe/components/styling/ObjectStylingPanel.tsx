import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextObjectStylingPanel } from './TextObjectStylingPanel';
import { ShapeObjectStylingPanel } from './ShapeObjectStylingPanel';
import { StickyNoteObjectStylingPanel } from './StickyNoteObjectStylingPanel';
import type { CanvasObject, TextNodeData, ShapeNodeData, StickyNoteData } from '../../types';
import { cn } from '@/lib/utils';

interface ObjectStylingPanelProps {
  /** Array of selected objects */
  selectedObjects: CanvasObject[];
  /** Callback to update object styling properties */
  onUpdateStyling: (objectId: string, updates: Partial<TextNodeData | ShapeNodeData | StickyNoteData>) => void;
  /** Additional CSS class name */
  className?: string;
}

export const ObjectStylingPanel: React.FC<ObjectStylingPanelProps> = ({
  selectedObjects,
  onUpdateStyling,
  className
}) => {
  if (selectedObjects.length === 0) {
    return (
      <Card className={cn("w-64", className)}>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          Select an object to customize its styling
        </CardContent>
      </Card>
    );
  }

  // If multiple objects selected, show message for now
  // In the future, we could implement bulk editing
  if (selectedObjects.length > 1) {
    const objectTypes = selectedObjects.map(obj => obj.type);
    const uniqueTypes = Array.from(new Set(objectTypes));
    
    return (
      <Card className={cn("w-64", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Multiple Objects ({selectedObjects.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-xs text-muted-foreground mb-3">
            Selected: {uniqueTypes.join(', ')}
          </div>
          <div className="text-sm text-muted-foreground">
            Bulk editing coming soon. Select a single object to customize styling.
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedObject = selectedObjects[0];

  // Create update handler for this specific object
  const handleUpdate = (updates: Partial<TextNodeData | ShapeNodeData | StickyNoteData>) => {
    onUpdateStyling(selectedObject.id, updates);
  };

  // Render appropriate styling panel based on object type
  const renderStylingPanel = () => {
    switch (selectedObject.type) {
      case 'text':
        return (
          <TextObjectStylingPanel
            data={(selectedObject as CanvasObject & { data: TextNodeData }).data}
            onUpdate={handleUpdate}
          />
        );

      case 'shape':
        return (
          <ShapeObjectStylingPanel
            data={(selectedObject as CanvasObject & { data: ShapeNodeData }).data}
            onUpdate={handleUpdate}
          />
        );

      case 'sticky':
        return (
          <StickyNoteObjectStylingPanel
            data={(selectedObject as CanvasObject & { data: StickyNoteData }).data}
            onUpdate={handleUpdate}
          />
        );

      default:
        return (
          <div className="text-sm text-muted-foreground p-4 text-center">
            No styling options available for {selectedObject.type}
          </div>
        );
    }
  };

  return (
    <Card className={cn("w-64", className)} data-testid="object-styling-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium capitalize">
          {selectedObject.type} Styling
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {renderStylingPanel()}
      </CardContent>
    </Card>
  );
};