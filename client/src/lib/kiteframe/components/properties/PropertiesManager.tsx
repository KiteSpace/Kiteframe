import React from 'react';
import { PropertiesPanel } from './PropertiesPanel';
import { BasicNodeProperties } from './BasicNodeProperties';
import { ImageNodeProperties } from './ImageNodeProperties';
import type { Node, Edge, CanvasObject } from '../../types';
import type { BasicNodeData } from '../BasicNode';
import type { ImageNodeData } from '../ImageNode';

interface PropertiesManagerProps {
  selectedNode?: Node;
  selectedEdge?: Edge;
  selectedCanvasObject?: CanvasObject;
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onCanvasObjectUpdate?: (objectId: string, updates: Partial<any>) => void;
  onClose?: () => void;
  // Image node specific handlers
  onImageUpload?: (nodeId: string, file: File) => Promise<string>;
  onImageUrlSet?: (nodeId: string, url: string) => void;
  // Panel customization
  title?: string;
  position?: { x: number; y: number };
  className?: string;
  style?: React.CSSProperties;
}

export const PropertiesManager: React.FC<PropertiesManagerProps> = ({
  selectedNode,
  selectedEdge,
  selectedCanvasObject,
  onNodeUpdate,
  onEdgeUpdate,
  onCanvasObjectUpdate,
  onClose,
  onImageUpload,
  onImageUrlSet,
  title = 'Properties',
  position,
  className,
  style
}) => {
  // Don't render if nothing is selected
  if (!selectedNode && !selectedEdge && !selectedCanvasObject) {
    return null;
  }

  const renderNodeProperties = () => {
    if (!selectedNode) return null;

    switch (selectedNode.type) {
      case 'basic':
        return (
          <BasicNodeProperties
            node={selectedNode as Node & { data: BasicNodeData }}
            onUpdate={onNodeUpdate}
          />
        );
      
      case 'image':
        return (
          <ImageNodeProperties
            node={selectedNode as Node & { data: ImageNodeData }}
            onUpdate={onNodeUpdate}
            onImageUpload={onImageUpload}
            onImageUrlSet={onImageUrlSet}
          />
        );
      
      default:
        // Fallback for unknown node types
        return (
          <div className="space-y-2">
            <div className="text-xs font-medium">Node Type: {selectedNode.type || 'Unknown'}</div>
            <div className="text-xs text-muted-foreground">
              Properties panel not available for this node type.
            </div>
          </div>
        );
    }
  };

  const renderEdgeProperties = () => {
    if (!selectedEdge) return null;

    return (
      <div className="space-y-2">
        <div className="text-xs font-medium">Edge Type: {selectedEdge.type || 'default'}</div>
        <div className="text-xs text-muted-foreground">
          Edge properties panel coming soon.
        </div>
      </div>
    );
  };

  const renderCanvasObjectProperties = () => {
    if (!selectedCanvasObject) return null;

    return (
      <div className="space-y-2">
        <div className="text-xs font-medium">Object Type: {selectedCanvasObject.type}</div>
        <div className="text-xs text-muted-foreground">
          Canvas object properties panel coming soon.
        </div>
      </div>
    );
  };

  return (
    <PropertiesPanel
      title={title}
      onClose={onClose}
      position={position}
      className={className}
      style={style}
    >
      {selectedNode && renderNodeProperties()}
      {selectedEdge && renderEdgeProperties()}
      {selectedCanvasObject && renderCanvasObjectProperties()}
    </PropertiesPanel>
  );
};