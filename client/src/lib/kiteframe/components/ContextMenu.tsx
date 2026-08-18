import React, { useEffect, useRef, useMemo, useState } from 'react';
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
  const [focusedIndex, setFocusedIndex] = useState(0);
  const cleanupManager = useEventCleanup();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Get non-separator items for navigation
      const navigableItems = items.filter(item => !item.separator);
      const currentIndex = navigableItems.findIndex((_, idx) => idx === focusedIndex);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          const nextIndex = (currentIndex + 1) % navigableItems.length;
          setFocusedIndex(nextIndex);
          break;
        case 'ArrowUp':
          event.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : navigableItems.length - 1;
          setFocusedIndex(prevIndex);
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(navigableItems.length - 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          const focusedItem = navigableItems[focusedIndex];
          if (focusedItem && !focusedItem.disabled && focusedItem.onClick) {
            focusedItem.onClick();
            onClose();
          }
          break;
      }
    };

    // Use cleanup manager for event listeners
    const cleanupClick = cleanupManager.addEventListener(document, 'mousedown', handleClickOutside);
    const cleanupKeyboard = cleanupManager.addEventListener(document, 'keydown', handleKeyDown);

    return () => {
      cleanupClick();
      cleanupKeyboard();
    };
  }, [onClose, cleanupManager, items, focusedIndex]);

  // Focus the menu when it opens and focus items as they're navigated
  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const navigableItems = items.filter(item => !item.separator);
    if (itemRefs.current[focusedIndex] && focusedIndex < navigableItems.length) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, items]);

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

  // Track navigable item indices
  let navigableIndex = 0;

  return (
    <div
      ref={menuRef}
      className={`fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999] min-w-[200px] ${positionClass}`}
      role="menu"
      aria-label="Context menu"
      tabIndex={-1}
      data-testid="context-menu"
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="border-t border-gray-200 my-1"
              role="separator"
            />
          );
        }

        const isCurrentNavigableItem = navigableIndex === focusedIndex;
        const buttonRef = (el: HTMLButtonElement | null) => {
          itemRefs.current[navigableIndex] = el;
        };
        navigableIndex++;

        return (
          <button
            key={item.id}
            ref={buttonRef}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
            aria-disabled={item.disabled}
            tabIndex={isCurrentNavigableItem ? 0 : -1}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-100 transition-colors ${
              item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${
              isCurrentNavigableItem ? 'bg-gray-50 outline-none ring-2 ring-inset ring-blue-500' : ''
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