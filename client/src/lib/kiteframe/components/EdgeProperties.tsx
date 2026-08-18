import React, { useState, useEffect, useCallback } from 'react';
import { Edge } from '../types';
import { sanitizeText, validateColor } from '../utils/validation';

export interface EdgePropertiesProps {
  edge: Edge | null;
  onUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  onClose: () => void;
}

type StrokeStyle = 'solid' | 'dashed' | 'dotted';

// Helper to detect stroke style from edge properties
const detectStrokeStyle = (edge: Edge | null): StrokeStyle => {
  if (!edge?.style?.strokeDasharray) return 'solid';
  const linecap = edge.style.strokeLinecap;
  if (linecap === 'round' || edge.style.strokeDasharray.includes('0.1')) return 'dotted';
  return 'dashed';
};

// Helper to get stroke style config
const getStrokeStyleConfig = (style: StrokeStyle): { dasharray: string | undefined; linecap: 'butt' | 'round' } => {
  switch (style) {
    case 'dotted': return { dasharray: '0.1 6', linecap: 'round' };
    case 'dashed': return { dasharray: '8 4', linecap: 'butt' };
    default: return { dasharray: undefined, linecap: 'butt' };
  }
};

const EdgePropertiesComponent: React.FC<EdgePropertiesProps> = ({
  edge,
  onUpdate,
  onClose
}) => {
  const [label, setLabel] = useState('');
  const [edgeType, setEdgeType] = useState<Edge['type']>('bezier');
  const [animated, setAnimated] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#6b7280');
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [labelBgColor, setLabelBgColor] = useState('#ffffff');
  const [markerEnd, setMarkerEnd] = useState(true);
  const [markerStart, setMarkerStart] = useState(false);

  useEffect(() => {
    if (edge) {
      setLabel(edge.label || '');
      setEdgeType(edge.type || 'bezier');
      setAnimated(edge.animated || false);
      setStrokeWidth(edge.style?.strokeWidth || 2);
      setStrokeColor(edge.style?.stroke || edge.style?.strokeColor || '#6b7280');
      setStrokeStyle(detectStrokeStyle(edge));
      setLabelBgColor(edge.labelStyle?.backgroundColor || '#ffffff');
      setMarkerEnd(edge.markerEnd !== false);
      setMarkerStart(edge.markerStart === true || (typeof edge.markerStart === 'object'));
    }
  }, [edge]);

  if (!edge) return null;

  const handleSave = useCallback(() => {
    // Validate and sanitize inputs before saving
    const sanitizedLabel = label ? sanitizeText(label) : '';
    const validatedStrokeColor = validateColor(strokeColor) ? strokeColor : '#6b7280';
    const validatedLabelBgColor = validateColor(labelBgColor) ? labelBgColor : '#ffffff';
    const clampedStrokeWidth = Math.min(Math.max(strokeWidth, 1), 10);
    const strokeStyleConfig = getStrokeStyleConfig(strokeStyle);
    
    onUpdate(edge.id, {
      label: sanitizedLabel,
      type: edgeType,
      animated,
      style: {
        strokeWidth: clampedStrokeWidth,
        stroke: validatedStrokeColor,
        strokeColor: validatedStrokeColor,
        strokeDasharray: strokeStyleConfig.dasharray,
        strokeLinecap: strokeStyleConfig.linecap
      },
      labelStyle: {
        backgroundColor: validatedLabelBgColor
      },
      markerEnd,
      markerStart
    });
    onClose();
  }, [label, strokeColor, labelBgColor, strokeWidth, strokeStyle, edge.id, edgeType, animated, markerEnd, markerStart, onUpdate, onClose]);

  return (
    <div className="absolute right-4 top-20 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Edge Properties</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            data-testid="close-edge-properties"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter edge label"
            data-testid="edge-label-input"
          />
        </div>

        {/* Edge Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Edge Type
          </label>
          <select
            value={edgeType}
            onChange={(e) => setEdgeType(e.target.value as Edge['type'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="edge-type-select"
          >
            <option value="bezier">Bezier</option>
            <option value="straight">Straight</option>
            <option value="step">Step</option>
            <option value="smoothstep">Smooth Step</option>
          </select>
        </div>

        {/* Animation */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Animated
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={animated}
              onChange={(e) => setAnimated(e.target.checked)}
              className="sr-only peer"
              data-testid="edge-animated-toggle"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Stroke Width */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stroke Width
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="1"
              max="10"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="flex-1"
              data-testid="edge-stroke-width-slider"
            />
            <span className="text-sm text-gray-600 w-8">{strokeWidth}px</span>
          </div>
        </div>

        {/* Stroke Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stroke Style
          </label>
          <div className="flex gap-2">
            {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setStrokeStyle(style)}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  strokeStyle === style
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                data-testid={`edge-stroke-style-${style}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <svg width="40" height="8" className="mx-auto">
                    <line 
                      x1="2" y1="4" x2="38" y2="4" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeDasharray={style === 'dashed' ? '6 3' : style === 'dotted' ? '0.1 4' : undefined}
                      strokeLinecap={style === 'dotted' ? 'round' : 'butt'}
                    />
                  </svg>
                  <span className="capitalize">{style}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stroke Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
              data-testid="edge-stroke-color-picker"
            />
            <input
              type="text"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              placeholder="#6b7280"
            />
          </div>
        </div>

        {/* Label Background Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label Background
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={labelBgColor}
              onChange={(e) => setLabelBgColor(e.target.value)}
              className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
              data-testid="edge-label-bg-color-picker"
            />
            <input
              type="text"
              value={labelBgColor}
              onChange={(e) => setLabelBgColor(e.target.value)}
              className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              placeholder="#ffffff"
            />
          </div>
        </div>

        {/* Markers */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arrows
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Start Arrow</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={markerStart}
                onChange={(e) => setMarkerStart(e.target.checked)}
                className="sr-only peer"
                data-testid="edge-marker-start-toggle"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">End Arrow</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={markerEnd}
                onChange={(e) => setMarkerEnd(e.target.checked)}
                className="sr-only peer"
                data-testid="edge-marker-end-toggle"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="edge-properties-cancel"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="edge-properties-save"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const EdgeProperties = React.memo(EdgePropertiesComponent);