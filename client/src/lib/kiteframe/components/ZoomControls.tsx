import React from 'react';

export interface ZoomControlsProps {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomToFit?: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  minZoom = 0.1,
  maxZoom = 2,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomToFit,
  position = 'bottom-left',
  orientation = 'vertical',
  className = ''
}) => {
  const zoomPercentage = Math.round(zoom * 100);
  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const orientationClasses = orientation === 'horizontal' 
    ? 'flex-row space-x-1' 
    : 'flex-col space-y-1';

  return (
    <div
      className={`absolute ${positionClasses[position]} bg-white rounded-lg shadow-lg border border-gray-200 p-2 ${className}`}
      role="group"
      aria-label="Zoom controls"
      data-testid="zoom-controls"
    >
      <div className={`flex ${orientationClasses}`}>
        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          disabled={!canZoomIn}
          className={`p-2 rounded hover:bg-gray-100 transition-colors ${
            !canZoomIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Zoom In (Ctrl++)"
          aria-label="Zoom in"
          aria-keyshortcuts="Control+Plus"
          data-testid="zoom-in-button"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </button>

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          disabled={!canZoomOut}
          className={`p-2 rounded hover:bg-gray-100 transition-colors ${
            !canZoomOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Zoom Out (Ctrl+-)"
          aria-label="Zoom out"
          aria-keyshortcuts="Control+Minus"
          data-testid="zoom-out-button"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
            />
          </svg>
        </button>

        {/* Zoom Reset */}
        <button
          onClick={onZoomReset}
          className="p-2 rounded hover:bg-gray-100 transition-colors cursor-pointer"
          title="Reset Zoom (Ctrl+0)"
          aria-label="Reset zoom to 100%"
          aria-keyshortcuts="Control+0"
          data-testid="zoom-reset-button"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        {/* Zoom to Fit */}
        {onZoomToFit && (
          <button
            onClick={onZoomToFit}
            className="p-2 rounded hover:bg-gray-100 transition-colors cursor-pointer"
            title="Fit to Screen"
            aria-label="Fit all content to screen"
            data-testid="zoom-fit-button"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Zoom Level Display */}
      <div 
        className="text-xs text-gray-600 text-center mt-2 font-medium"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Current zoom level: ${zoomPercentage} percent`}
      >
        <span aria-hidden="true">{zoomPercentage}%</span>
      </div>
    </div>
  );
};