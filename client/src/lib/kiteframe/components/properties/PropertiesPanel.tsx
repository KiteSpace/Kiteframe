import React from 'react';
import { cn } from '@/lib/utils';
import { X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PropertiesPanelProps {
  title?: string;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  position?: { x: number; y: number };
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  title = 'Properties',
  onClose,
  children,
  className,
  style,
  position = { x: 48, y: 64 } // Default: left-12 top-16
}) => {
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    zIndex: 100,
    ...style
  };

  return (
    <div 
      className={cn(
        'w-72 bg-card border border-border rounded-md shadow-lg',
        className
      )}
      style={panelStyle}
      data-testid="properties-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Square className="w-4 h-4" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
            data-testid="close-properties"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};