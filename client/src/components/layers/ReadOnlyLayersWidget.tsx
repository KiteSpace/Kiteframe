import * as React from 'react';
import { ListTree, ChevronRight, ChevronDown, Circle, Square, Diamond, Hexagon, Play, FileOutput, Sparkles, Image } from 'lucide-react';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

type Props = {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
};

function getNodeIcon(type: string | undefined) {
  switch (type) {
    case 'input': return Play;
    case 'output': return FileOutput;
    case 'process': return Square;
    case 'condition': return Diamond;
    case 'ai': return Sparkles;
    case 'image': return Image;
    default: return Circle;
  }
}

function getNodeColor(type: string | undefined) {
  switch (type) {
    case 'input': return 'text-green-500';
    case 'output': return 'text-blue-500';
    case 'process': return 'text-purple-500';
    case 'condition': return 'text-yellow-500';
    case 'ai': return 'text-pink-500';
    case 'image': return 'text-cyan-500';
    default: return 'text-gray-500';
  }
}

export function ReadOnlyLayersWidget({ nodes, edges, canvasObjects }: Props) {
  const [open, setOpen] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(['nodes', 'edges']));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="absolute top-4 right-4 z-50">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-card border border-border rounded-full shadow-lg px-4 py-2 hover:shadow-xl transition-shadow select-none"
          style={{ minHeight: '40px' }}
          title="Layers"
          data-testid="button-layers"
        >
          <ListTree size={16} />
          <span className="text-sm font-medium">Layers</span>
        </button>
      )}
      {open && (
        <div className="w-[300px] max-h-[400px] rounded-xl shadow-2xl border border-border bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <ListTree size={16} />
              Layers (Read Only)
            </div>
            <button
              className="text-xs opacity-70 hover:opacity-100 text-gray-700 dark:text-gray-300"
              onClick={() => setOpen(false)}
              data-testid="button-close-layers"
            >
              Close
            </button>
          </div>
          <div className="overflow-y-auto max-h-[340px] p-2">
            <div className="space-y-1">
              <button
                onClick={() => toggleGroup('nodes')}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left"
                data-testid="toggle-nodes-group"
              >
                {expandedGroups.has('nodes') ? (
                  <ChevronDown size={14} className="text-gray-500" />
                ) : (
                  <ChevronRight size={14} className="text-gray-500" />
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Nodes ({nodes.length})
                </span>
              </button>
              
              {expandedGroups.has('nodes') && (
                <div className="ml-4 space-y-0.5">
                  {nodes.map(node => {
                    const Icon = getNodeIcon(node.type);
                    const colorClass = getNodeColor(node.type);
                    const label = node.data?.label || node.data?.name || node.id;
                    return (
                      <div
                        key={node.id}
                        className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        data-testid={`layer-node-${node.id}`}
                      >
                        <Icon size={14} className={colorClass} />
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => toggleGroup('edges')}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left"
                data-testid="toggle-edges-group"
              >
                {expandedGroups.has('edges') ? (
                  <ChevronDown size={14} className="text-gray-500" />
                ) : (
                  <ChevronRight size={14} className="text-gray-500" />
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Edges ({edges.length})
                </span>
              </button>
              
              {expandedGroups.has('edges') && (
                <div className="ml-4 space-y-0.5">
                  {edges.map(edge => {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    const targetNode = nodes.find(n => n.id === edge.target);
                    const sourceLabel = sourceNode?.data?.label || sourceNode?.data?.name || edge.source;
                    const targetLabel = targetNode?.data?.label || targetNode?.data?.name || edge.target;
                    return (
                      <div
                        key={edge.id}
                        className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        data-testid={`layer-edge-${edge.id}`}
                      >
                        <span className="text-gray-400">→</span>
                        <span className="truncate">{sourceLabel} → {targetLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {canvasObjects && canvasObjects.length > 0 && (
                <>
                  <button
                    onClick={() => toggleGroup('objects')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left"
                    data-testid="toggle-objects-group"
                  >
                    {expandedGroups.has('objects') ? (
                      <ChevronDown size={14} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500" />
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Objects ({canvasObjects.length})
                    </span>
                  </button>
                  
                  {expandedGroups.has('objects') && (
                    <div className="ml-4 space-y-0.5">
                      {canvasObjects.map(obj => (
                        <div
                          key={obj.id}
                          className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          data-testid={`layer-object-${obj.id}`}
                        >
                          <Square size={14} className="text-blue-500" />
                          <span className="truncate capitalize">{obj.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReadOnlyLayersWidget;
