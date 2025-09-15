import React, { useEffect, useRef, useMemo } from 'react';
import { getDynamicClassName } from '../utils/styles';
import { useEventCleanup } from '../utils/eventCleanup';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  position,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const cleanupManager = useEventCleanup();

  // Get dynamic class for positioning
  const positionClass = useMemo(() => {
    return getDynamicClassName({
      left: `${position.x}px`,
      top: `${position.y}px`
    }, 'context-menu-position');
  }, [position.x, position.y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Use cleanup manager for event listeners
    const cleanupClick = cleanupManager.addEventListener(document, 'mousedown', handleClickOutside);
    const cleanupKeyboard = cleanupManager.addEventListener(document, 'keydown', handleEscape);

    return () => {
      cleanupClick();
      cleanupKeyboard();
    };
  }, [onClose, cleanupManager]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      // Adjust horizontally if menu would go off screen
      if (rect.right > viewportWidth) {
        adjustedX = Math.max(0, viewportWidth - rect.width);
      }

      // Adjust vertically if menu would go off screen
      if (rect.bottom > viewportHeight) {
        adjustedY = Math.max(0, viewportHeight - rect.height);
      }

      // Apply adjusted position using CSS classes
      const adjustedPositionClass = getDynamicClassName({
        left: `${adjustedX}px`,
        top: `${adjustedY}px`
      }, 'context-menu-adjusted');
      menuRef.current.className = menuRef.current.className.replace(/kf-context-menu-\S+/g, '') + ' ' + adjustedPositionClass;
    }
  }, [position]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && item.onClick) {
      item.onClick();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className={`fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999] min-w-[200px] ${positionClass}`}
      data-testid="context-menu"
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="border-t border-gray-200 my-1"
            />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-100 transition-colors ${
              item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            data-testid={`context-menu-item-${item.id}`}
          >
            <div className="flex items-center space-x-2">
              {item.icon && (
                <span className="text-gray-600 w-4 h-4">{item.icon}</span>
              )}
              <span className="text-sm text-gray-700">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-xs text-gray-400 ml-4">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};