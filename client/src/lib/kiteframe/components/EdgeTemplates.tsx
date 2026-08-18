import React from 'react';
import { Edge } from '../types';

export interface EdgeTemplate {
  id: string;
  name: string;
  description: string;
  preview: React.ReactNode;
  edgeData: Partial<Edge>;
}

export const defaultEdgeTemplates: EdgeTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard connection with arrow',
    preview: (
      <svg width="100" height="40" viewBox="0 0 100 40">
        <defs>
          <marker id="arrow-default" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
          </marker>
        </defs>
        <path d="M 10 20 L 90 20" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrow-default)" />
      </svg>
    ),
    edgeData: {
      type: 'straight',
      style: { stroke: '#6b7280', strokeWidth: 2 },
      markerEnd: true
    }
  },
  {
    id: 'animated',
    name: 'Animated Flow',
    description: 'Animated dashed line showing data flow',
    preview: (
      <svg width="100" height="40" viewBox="0 0 100 40">
        <defs>
          <marker id="arrow-animated" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
          </marker>
        </defs>
        <path 
          d="M 10 20 L 90 20" 
          stroke="#3b82f6" 
          strokeWidth="2" 
          strokeDasharray="5,5"
          markerEnd="url(#arrow-animated)"
        />
      </svg>
    ),
    edgeData: {
      type: 'straight',
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      markerEnd: true
    }
  },
  {
    id: 'bidirectional',
    name: 'Bidirectional',
    description: 'Two-way connection with arrows on both ends',
    preview: (
      <svg width="100" height="40" viewBox="0 0 100 40">
        <defs>
          <marker id="arrow-start" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto">
            <polygon points="10 0, 0 3, 10 6" fill="#10b981" />
          </marker>
          <marker id="arrow-end" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
          </marker>
        </defs>
        <path 
          d="M 10 20 L 90 20" 
          stroke="#10b981" 
          strokeWidth="2" 
          markerStart="url(#arrow-start)"
          markerEnd="url(#arrow-end)"
        />
      </svg>
    ),
    edgeData: {
      type: 'straight',
      style: { stroke: '#10b981', strokeWidth: 2 },
      markerStart: true,
      markerEnd: true
    }
  },
  {
    id: 'conditional',
    name: 'Conditional',
    description: 'Dashed line for conditional paths',
    preview: (
      <svg width="100" height="40" viewBox="0 0 100 40">
        <defs>
          <marker id="arrow-conditional" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#f59e0b" />
          </marker>
        </defs>
        <path 
          d="M 10 20 L 90 20" 
          stroke="#f59e0b" 
          strokeWidth="2" 
          strokeDasharray="8,4"
          markerEnd="url(#arrow-conditional)"
        />
      </svg>
    ),
    edgeData: {
      type: 'straight',
      style: { 
        stroke: '#f59e0b', 
        strokeWidth: 2,
        strokeDasharray: '8,4'
      },
      markerEnd: true,
      label: 'if/else'
    }
  },
  {
    id: 'error',
    name: 'Error Path',
    description: 'Red connection for error handling',
    preview: (
      <svg width="100" height="40" viewBox="0 0 100 40">
        <defs>
          <marker id="arrow-error" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
          </marker>
        </defs>
        <path 
          d="M 10 20 L 90 20" 
          stroke="#ef4444" 
          strokeWidth="3" 
          markerEnd="url(#arrow-error)"
        />
      </svg>
    ),
    edgeData: {
      type: 'straight',
      style: { stroke: '#ef4444', strokeWidth: 3 },
      markerEnd: true,
      label: 'error',
      labelStyle: { backgroundColor: '#fef2f2', color: '#ef4444' }
    }
  },
  {
    id: 'success',
    name: 'Success Path',
    description: 'Green connection for success flows',
    preview: (
      <svg width="100" height="40" viewBox="0 0 100 40">
        <defs>
          <marker id="arrow-success" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#22c55e" />
          </marker>
        </defs>
        <path 
          d="M 10 20 L 90 20" 
          stroke="#22c55e" 
          strokeWidth="3" 
          markerEnd="url(#arrow-success)"
        />
      </svg>
    ),
    edgeData: {
      type: 'straight',
      style: { stroke: '#22c55e', strokeWidth: 3 },
      markerEnd: true,
      label: 'success',
      labelStyle: { backgroundColor: '#f0fdf4', color: '#22c55e' }
    }
  }
];

export interface EdgeTemplatesListProps {
  onSelect: (template: EdgeTemplate) => void;
  selectedId?: string;
}

export const EdgeTemplatesList: React.FC<EdgeTemplatesListProps> = ({
  onSelect,
  selectedId
}) => {
  return (
    <div className="space-y-2">
      {defaultEdgeTemplates.map(template => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className={`w-full p-3 rounded-lg border transition-all hover:shadow-md ${
            selectedId === template.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          data-testid={`edge-template-${template.id}`}
        >
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-24">
              {template.preview}
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-medium text-gray-900">
                {template.name}
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                {template.description}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};