import type { Node } from '../lib/kiteframe/types';

interface SidebarProps {
  selectedNode?: Node;
  onCreateNode: (type: string) => void;
  onFitView: () => void;
  onClearCanvas: () => void;
  onExport: () => void;
  onNodeUpdate: (nodeId: string, updates: Partial<Node>) => void;
}

export function Sidebar({
  selectedNode,
  onCreateNode,
  onFitView,
  onClearCanvas,
  onExport,
  onNodeUpdate
}: SidebarProps) {
  const nodeTypes = [
    { type: 'input', icon: 'fas fa-sign-in-alt', color: 'text-blue-500', label: 'Input' },
    { type: 'process', icon: 'fas fa-cogs', color: 'text-green-500', label: 'Process' },
    { type: 'condition', icon: 'fas fa-question-circle', color: 'text-yellow-500', label: 'Condition' },
    { type: 'output', icon: 'fas fa-sign-out-alt', color: 'text-red-500', label: 'Output' },
    { type: 'ai', icon: 'fas fa-robot', color: 'text-purple-500', label: 'AI Task' },
    { type: 'image', icon: 'fas fa-image', color: 'text-indigo-500', label: 'Image' }
  ];

  return (
    <aside className="w-64 p-4 bg-card border-r border-border shadow-sm" data-testid="sidebar">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Node Types</h3>
          <div className="grid grid-cols-2 gap-2">
            {nodeTypes.map((nodeType) => (
              <div
                key={nodeType.type}
                className="p-3 border border-border rounded-md cursor-pointer text-center hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                onClick={() => onCreateNode(nodeType.type)}
                data-testid={`node-type-${nodeType.type}`}
              >
                <i className={`${nodeType.icon} ${nodeType.color} mb-1 text-base`} />
                <div className="text-xs font-medium">{nodeType.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Properties</h3>
          <div className="space-y-3" data-testid="node-properties">
            {selectedNode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Node ID</label>
                  <input
                    type="text"
                    value={selectedNode.id}
                    className="w-full p-2 text-xs border border-border rounded bg-background"
                    readOnly
                    data-testid="input-node-id"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedNode.data?.label || ''}
                    onChange={(e) => onNodeUpdate(selectedNode.id, {
                      data: { ...selectedNode.data, label: e.target.value }
                    })}
                    className="w-full p-2 text-xs border border-border rounded bg-background"
                    data-testid="input-node-label"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    value={selectedNode.data?.description || ''}
                    onChange={(e) => onNodeUpdate(selectedNode.id, {
                      data: { ...selectedNode.data, description: e.target.value }
                    })}
                    className="w-full p-2 text-xs border border-border rounded bg-background"
                    rows={3}
                    placeholder="Enter description..."
                    data-testid="textarea-node-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Width</label>
                    <input
                      type="number"
                      value={selectedNode.width || 200}
                      onChange={(e) => onNodeUpdate(selectedNode.id, {
                        width: parseInt(e.target.value) || 200
                      })}
                      className="w-full p-2 text-xs border border-border rounded bg-background"
                      data-testid="input-node-width"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Height</label>
                    <input
                      type="number"
                      value={selectedNode.height || 100}
                      onChange={(e) => onNodeUpdate(selectedNode.id, {
                        height: parseInt(e.target.value) || 100
                      })}
                      className="w-full p-2 text-xs border border-border rounded bg-background"
                      data-testid="input-node-height"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a node to edit properties
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Actions</h3>
          <div className="space-y-2">
            <button
              className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left"
              onClick={onFitView}
              data-testid="button-fit-view"
            >
              <i className="fas fa-expand-arrows-alt mr-2" />
              Fit to View
            </button>
            <button
              className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left"
              onClick={onClearCanvas}
              data-testid="button-clear-canvas"
            >
              <i className="fas fa-trash mr-2" />
              Clear Canvas
            </button>
            <button
              className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left"
              onClick={onExport}
              data-testid="button-export"
            >
              <i className="fas fa-download mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
