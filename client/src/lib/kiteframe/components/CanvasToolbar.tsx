import React from 'react';

export interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  separator?: boolean;
  tooltip?: string;
}

export interface CanvasToolbarProps {
  actions: ToolbarAction[];
  position?: 'top' | 'bottom';
  alignment?: 'left' | 'center' | 'right';
  className?: string;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  actions,
  position = 'top',
  alignment = 'center',
  className = ''
}) => {
  // Position classes
  const positionClasses = position === 'top' ? 'top-4' : 'bottom-4';
  
  // Alignment classes
  const alignmentClasses = {
    left: 'left-4',
    center: 'left-1/2 transform -translate-x-1/2',
    right: 'right-4'
  };

  return (
    <div
      className={`absolute ${positionClasses} ${alignmentClasses[alignment]} bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1 flex items-center space-x-1 ${className}`}
      role="toolbar"
      aria-label="Canvas toolbar"
      aria-orientation="horizontal"
      data-testid="canvas-toolbar"
    >
      {actions.map((action, index) => {
        if (action.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="w-px h-6 bg-gray-300 mx-1"
              role="separator"
              aria-orientation="vertical"
            />
          );
        }

        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.tooltip || action.label}
            aria-label={action.label}
            aria-pressed={action.active}
            role="button"
            tabIndex={action.disabled ? -1 : 0}
            className={`p-2 rounded transition-colors ${
              action.active
                ? 'bg-blue-100 text-blue-600'
                : action.disabled
                ? 'opacity-50 cursor-not-allowed text-gray-400'
                : 'hover:bg-gray-100 text-gray-700 cursor-pointer'
            }`}
            data-testid={`toolbar-action-${action.id}`}
          >
            <div className="w-5 h-5 flex items-center justify-center" aria-hidden="true">
              {action.icon}
            </div>
          </button>
        );
      })}
    </div>
  );
};

// Common toolbar action icons
export const ToolbarIcons = {
  select: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M15 15l-2 5L9 9l11 4-5 2z" />
    </svg>
  ),
  hand: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v.5m0 0a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  ),
  addNode: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 4v16m8-8H4" />
    </svg>
  ),
  undo: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  ),
  redo: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
    </svg>
  ),
  delete: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  copy: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  ),
  paste: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  layout: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  save: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
    </svg>
  ),
  export: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  settings: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
};