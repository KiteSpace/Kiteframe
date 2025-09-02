import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopyProperties: () => void;
  onPasteProperties?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  hasPropertiesInClipboard?: boolean;
}

export function ContextMenu({ x, y, onClose, onCopyProperties, onPasteProperties, onDuplicate, onDelete, hasPropertiesInClipboard }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-48"
      style={{ left: x, top: y }}
      data-testid="context-menu"
    >
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={onCopyProperties}
        data-testid="context-menu-copy-properties"
      >
        <i className="fas fa-palette mr-2" />
        Copy Properties
      </div>
      {hasPropertiesInClipboard && onPasteProperties && (
        <div
          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
          onClick={onPasteProperties}
          data-testid="context-menu-paste-properties"
        >
          <i className="fas fa-brush mr-2" />
          Paste Properties
        </div>
      )}
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={onDuplicate}
        data-testid="context-menu-duplicate"
      >
        <i className="fas fa-clone mr-2" />
        Duplicate
      </div>
      <div className="border-t border-border my-1" />
      <div
        className="px-3 py-2 hover:bg-destructive/10 cursor-pointer text-sm text-destructive"
        onClick={onDelete}
        data-testid="context-menu-delete"
      >
        <i className="fas fa-trash mr-2" />
        Delete
      </div>
    </div>
  );
}
