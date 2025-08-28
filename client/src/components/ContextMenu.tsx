import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ContextMenu({ x, y, onClose, onCopy, onDuplicate, onDelete }: ContextMenuProps) {
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
        onClick={onCopy}
        data-testid="context-menu-copy"
      >
        <i className="fas fa-copy mr-2" />
        Copy Node
      </div>
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
