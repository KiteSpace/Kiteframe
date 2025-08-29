import React from 'react';
import type { Edge } from '../lib/kiteframe/types';
import { 
  Palette,
  Minus,
  MoreHorizontal,
  Zap,
  Tag,
  X,
  Sliders
} from 'lucide-react';

interface EdgeCustomizerProps {
  selectedEdge?: Edge;
  onEdgeUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  onDeselectEdge: () => void;
}

export function EdgeCustomizer({ selectedEdge, onEdgeUpdate, onDeselectEdge }: EdgeCustomizerProps) {
  if (!selectedEdge) return null;

  const edgeTypes = [
    { value: 'straight', label: 'Straight' },
    { value: 'bezier', label: 'Bezier' },
    { value: 'step', label: 'Step' },
    { value: 'curved', label: 'Curved' },
    { value: 'orthogonal', label: 'Orthogonal' },
    { value: 'smoothstep', label: 'Smooth Step' }
  ];

  const markerTypes = [
    { value: 'arrow', label: 'Arrow' },
    { value: 'circle', label: 'Circle' },
    { value: 'square', label: 'Square' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'triangle', label: 'Triangle' }
  ];

  const presetColors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'
  ];

  const currentStyle = selectedEdge.style || {};
  const currentMarkers = selectedEdge.markers || { type: 'arrow' };

  return (
    <div className="w-64 p-4 bg-card border-r border-border shadow-sm" data-testid="edge-customizer">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Edge Properties</h3>
          <button
            onClick={onDeselectEdge}
            className="p-1 rounded-md hover:bg-accent transition-colors"
            data-testid="button-close-edge-properties"
          >
            <X size={16} />
          </button>
        </div>

        {/* Edge Type */}
        <div>
          <label className="block text-xs font-medium mb-2">Connection Type</label>
          <select
            value={selectedEdge.type || 'bezier'}
            onChange={(e) => onEdgeUpdate(selectedEdge.id, { type: e.target.value as any })}
            className="w-full p-2 text-xs border border-border rounded bg-background"
            data-testid="select-edge-type"
          >
            {edgeTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stroke Properties */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium">Appearance</h4>
          
          {/* Color */}
          <div>
            <label className="block text-xs font-medium mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentStyle.strokeColor || '#64748b'}
                onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                  style: { ...currentStyle, strokeColor: e.target.value }
                })}
                className="w-8 h-8 border border-border rounded cursor-pointer"
                data-testid="input-edge-color"
              />
              <input
                type="text"
                value={currentStyle.strokeColor || '#64748b'}
                onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                  style: { ...currentStyle, strokeColor: e.target.value }
                })}
                className="flex-1 p-1 text-xs border border-border rounded bg-background"
                placeholder="#64748b"
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => onEdgeUpdate(selectedEdge.id, {
                    style: { ...currentStyle, strokeColor: color }
                  })}
                  className="w-6 h-6 border border-border rounded cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  data-testid={`preset-color-${color.slice(1)}`}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div>
            <label className="block text-xs font-medium mb-1">Thickness</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                value={currentStyle.strokeWidth || 2}
                onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                  style: { ...currentStyle, strokeWidth: parseInt(e.target.value) }
                })}
                className="flex-1"
                data-testid="range-edge-thickness"
              />
              <span className="text-xs text-muted-foreground w-6">
                {currentStyle.strokeWidth || 2}px
              </span>
            </div>
          </div>

          {/* Opacity */}
          <div>
            <label className="block text-xs font-medium mb-1">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentStyle.strokeOpacity || 1}
                onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                  style: { ...currentStyle, strokeOpacity: parseFloat(e.target.value) }
                })}
                className="flex-1"
                data-testid="range-edge-opacity"
              />
              <span className="text-xs text-muted-foreground w-8">
                {Math.round((currentStyle.strokeOpacity || 1) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Line Style */}
        <div>
          <label className="block text-xs font-medium mb-2">Line Style</label>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => onEdgeUpdate(selectedEdge.id, {
                style: { ...currentStyle, strokeDasharray: undefined }
              })}
              className={`p-2 text-xs border rounded hover:bg-accent transition-colors ${
                !currentStyle.strokeDasharray ? 'border-primary bg-primary/10' : 'border-border'
              }`}
              data-testid="button-line-solid"
            >
              ——
            </button>
            <button
              onClick={() => onEdgeUpdate(selectedEdge.id, {
                style: { ...currentStyle, strokeDasharray: '5 5' }
              })}
              className={`p-2 text-xs border rounded hover:bg-accent transition-colors ${
                currentStyle.strokeDasharray === '5 5' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
              data-testid="button-line-dashed"
            >
              - - -
            </button>
            <button
              onClick={() => onEdgeUpdate(selectedEdge.id, {
                style: { ...currentStyle, strokeDasharray: '2 2' }
              })}
              className={`p-2 text-xs border rounded hover:bg-accent transition-colors ${
                currentStyle.strokeDasharray === '2 2' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
              data-testid="button-line-dotted"
            >
              ···
            </button>
          </div>
        </div>

        {/* Animation */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={selectedEdge.animated || false}
              onChange={(e) => onEdgeUpdate(selectedEdge.id, { animated: e.target.checked })}
              className="rounded"
              data-testid="checkbox-edge-animated"
            />
            <Zap size={14} />
            Animated
          </label>
        </div>

        {/* Markers/Arrows */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium">Markers</h4>
          
          <div>
            <label className="block text-xs font-medium mb-1">Arrow Type</label>
            <select
              value={currentMarkers.type || 'arrow'}
              onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                markers: { ...currentMarkers, type: e.target.value as any }
              })}
              className="w-full p-2 text-xs border border-border rounded bg-background"
              data-testid="select-marker-type"
            >
              {markerTypes.map((marker) => (
                <option key={marker.value} value={marker.value}>
                  {marker.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Position</label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => onEdgeUpdate(selectedEdge.id, {
                  markers: { ...currentMarkers, position: 'start' }
                })}
                className={`p-1 text-xs border rounded hover:bg-accent transition-colors ${
                  currentMarkers.position === 'start' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
                data-testid="button-marker-start"
              >
                ←—
              </button>
              <button
                onClick={() => onEdgeUpdate(selectedEdge.id, {
                  markers: { ...currentMarkers, position: 'end' }
                })}
                className={`p-1 text-xs border rounded hover:bg-accent transition-colors ${
                  !currentMarkers.position || currentMarkers.position === 'end' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
                data-testid="button-marker-end"
              >
                —→
              </button>
              <button
                onClick={() => onEdgeUpdate(selectedEdge.id, {
                  markers: { ...currentMarkers, position: 'both' }
                })}
                className={`p-1 text-xs border rounded hover:bg-accent transition-colors ${
                  currentMarkers.position === 'both' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
                data-testid="button-marker-both"
              >
                ←→
              </button>
            </div>
          </div>
        </div>

        {/* Curvature for curved edges */}
        {selectedEdge.type === 'curved' && (
          <div>
            <label className="block text-xs font-medium mb-1">Curvature</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={selectedEdge.curvature || 0.5}
                onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                  curvature: parseFloat(e.target.value)
                })}
                className="flex-1"
                data-testid="range-edge-curvature"
              />
              <span className="text-xs text-muted-foreground w-8">
                {selectedEdge.curvature || 0.5}
              </span>
            </div>
          </div>
        )}

        {/* Label */}
        <div>
          <label className="block text-xs font-medium mb-1">Label</label>
          <input
            type="text"
            value={selectedEdge.label || ''}
            onChange={(e) => onEdgeUpdate(selectedEdge.id, { label: e.target.value })}
            placeholder="Add label..."
            className="w-full p-2 text-xs border border-border rounded bg-background"
            data-testid="input-edge-label"
          />
        </div>
      </div>
    </div>
  );
}