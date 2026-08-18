import React, { useState, useMemo, useCallback } from 'react';
import { Edge, Node } from '../types';
import { EdgeTemplatesList, defaultEdgeTemplates, EdgeTemplate } from './EdgeTemplates';
import { EdgeValidator, EdgeValidationRules, EdgeValidationResult } from '../utils/EdgeValidation';
import { sanitizeText, validateColor } from '../utils/validation';
import { getDynamicClassName } from '../utils/styles';

export interface EdgeFactoryProps {
  sourceNodeId: string;
  targetNodeId: string;
  onCreateEdge: (edge: Partial<Edge>) => void;
  onCancel: () => void;
  validationRules?: EdgeValidationRules;
  existingEdges?: Edge[];
  nodes?: Node[];
  position?: { x: number; y: number };
}

const EdgeFactoryComponent: React.FC<EdgeFactoryProps> = ({
  sourceNodeId,
  targetNodeId,
  onCreateEdge,
  onCancel,
  validationRules,
  existingEdges = [],
  nodes = [],
  position = { x: 100, y: 100 }
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<EdgeTemplate | null>(null);
  const [label, setLabel] = useState('');
  const [customOptions, setCustomOptions] = useState({
    animated: false,
    bidirectional: false,
    strokeWidth: 2,
    strokeColor: '#6b7280'
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize validator with provided rules
  const validator = useMemo(() => {
    return new EdgeValidator(validationRules || {});
  }, [validationRules]);

  const handleTemplateSelect = useCallback((template: EdgeTemplate) => {
    setSelectedTemplate(template);
    
    // Apply template defaults
    if (template.edgeData.label) {
      setLabel(template.edgeData.label);
    }
    if (template.edgeData.animated !== undefined) {
      setCustomOptions(prev => ({ ...prev, animated: template.edgeData.animated! }));
    }
    if (template.edgeData.style?.strokeWidth) {
      setCustomOptions(prev => ({ ...prev, strokeWidth: template.edgeData.style!.strokeWidth! }));
    }
    if (template.edgeData.style?.stroke) {
      setCustomOptions(prev => ({ ...prev, strokeColor: template.edgeData.style!.stroke! }));
    }
  }, []);

  const handleCreate = useCallback(() => {
    // Validate and sanitize inputs
    const sanitizedLabel = label ? sanitizeText(label) : undefined;
    const validatedColor = validateColor(customOptions.strokeColor) ? customOptions.strokeColor : '#6b7280';
    
    const edgeData: Partial<Edge> = {
      id: `edge-${Date.now()}`, // Temporary ID for validation
      source: sourceNodeId,
      target: targetNodeId,
      label: sanitizedLabel,
      ...(selectedTemplate?.edgeData || {})
    };

    // Apply custom options with validated values
    edgeData.animated = customOptions.animated;
    edgeData.style = {
      ...edgeData.style,
      stroke: validatedColor,
      strokeWidth: Math.min(Math.max(customOptions.strokeWidth, 1), 10) // Clamp between 1-10
    };
    
    if (customOptions.bidirectional) {
      edgeData.markerStart = true;
      edgeData.markerEnd = true;
    }

    // Validate the edge before creating
    if (validationRules && nodes.length > 0) {
      const validationResult = validator.validateEdge(
        edgeData as Edge,
        existingEdges,
        nodes
      );

      if (!validationResult.isValid) {
        setValidationError(validationResult.error || 'Invalid connection');
        return;
      }

      // Show warnings if any
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        console.warn('Edge validation warnings:', validationResult.warnings);
      }
    }

    // Clear any validation errors and create the edge
    setValidationError(null);
    onCreateEdge(edgeData);
  }, [label, customOptions, sourceNodeId, targetNodeId, selectedTemplate, validationRules, nodes, validator, existingEdges, onCreateEdge]);

  // Get dynamic class for positioning
  const positionClass = useMemo(() => {
    return getDynamicClassName({
      left: `${position.x}px`,
      top: `${position.y}px`
    }, 'edge-factory-position');
  }, [position.x, position.y]);

  return (
    <div 
      className={`absolute bg-white rounded-lg shadow-2xl border border-gray-200 z-50 w-96 ${positionClass}`}
    >
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Create Connection</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            data-testid="close-edge-factory"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Connecting from <span className="font-medium">{sourceNodeId}</span> to{' '}
          <span className="font-medium">{targetNodeId}</span>
        </p>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {validationError}
          </p>
        </div>
      )}

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Templates */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose Template
          </label>
          <EdgeTemplatesList
            onSelect={handleTemplateSelect}
            selectedId={selectedTemplate?.id}
          />
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Connection Label (Optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter connection label"
            data-testid="edge-factory-label-input"
          />
        </div>

        {/* Custom Options */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Custom Options</h4>
          
          {/* Animated */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">Animated</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={customOptions.animated}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, animated: e.target.checked }))}
                className="sr-only peer"
                data-testid="edge-factory-animated-toggle"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Bidirectional */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">Bidirectional</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={customOptions.bidirectional}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, bidirectional: e.target.checked }))}
                className="sr-only peer"
                data-testid="edge-factory-bidirectional-toggle"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Stroke Width */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">
              Stroke Width: {customOptions.strokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={customOptions.strokeWidth}
              onChange={(e) => setCustomOptions(prev => ({ ...prev, strokeWidth: Number(e.target.value) }))}
              className="w-full"
              data-testid="edge-factory-stroke-width-slider"
            />
          </div>

          {/* Stroke Color */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">
              Stroke Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={customOptions.strokeColor}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, strokeColor: e.target.value }))}
                className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                data-testid="edge-factory-stroke-color-picker"
              />
              <input
                type="text"
                value={customOptions.strokeColor}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, strokeColor: e.target.value }))}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
                placeholder="#6b7280"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="edge-factory-cancel"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="edge-factory-create"
        >
          Create Connection
        </button>
      </div>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const EdgeFactory = React.memo(EdgeFactoryComponent);