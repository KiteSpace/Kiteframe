import { useEffect, useRef } from 'react';
import { Palette, PaintBucket, Copy, Trash2, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Bug, Workflow, BookmarkMinus, Bookmark, FileText } from 'lucide-react';
import type { Node as KiteframeNode } from '@/lib/kiteframe/types';
import type { PRDNodeLink } from '@/stores/prdNodeLinkStore';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopyProperties: () => void;
  onPasteProperties?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  hasPropertiesInClipboard?: boolean;
  onBringForward?: () => void;
  onBringToFront?: () => void;
  onSendBackward?: () => void;
  onSendToBack?: () => void;
  onViewSemanticData?: () => void;
  node?: KiteframeNode;
  onGenerateWorkflowFromFrames?: (nodeIds: string[]) => void;
  onToggleReferenceFrame?: (nodeId: string) => void;
  prdLinks?: PRDNodeLink[];
  onViewLinkedPRD?: (link: PRDNodeLink) => void;
}

export function ContextMenu({ x, y, onClose, onCopyProperties, onPasteProperties, onDuplicate, onDelete, hasPropertiesInClipboard, onBringForward, onBringToFront, onSendBackward, onSendToBack, onViewSemanticData, node, onGenerateWorkflowFromFrames, onToggleReferenceFrame, prdLinks, onViewLinkedPRD }: ContextMenuProps) {
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
        <Palette size={16} className="mr-2" />
        Copy Properties
      </div>
      {hasPropertiesInClipboard && onPasteProperties && (
        <div
          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
          onClick={onPasteProperties}
          data-testid="context-menu-paste-properties"
        >
          <PaintBucket size={16} className="mr-2" />
          Paste Properties
        </div>
      )}
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={onDuplicate}
        data-testid="context-menu-duplicate"
      >
        <Copy size={16} className="mr-2" />
        Duplicate
      </div>
      
      {/* Z-Index Controls */}
      <div className="border-t border-border my-1" />
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={() => { onBringToFront?.(); onClose(); }}
        data-testid="context-menu-bring-to-front"
      >
        <ArrowUp size={16} className="mr-2" />
        Bring to Front
      </div>
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={() => { onBringForward?.(); onClose(); }}
        data-testid="context-menu-bring-forward"
      >
        <ChevronUp size={16} className="mr-2" />
        Bring Forward
      </div>
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={() => { onSendBackward?.(); onClose(); }}
        data-testid="context-menu-send-backward"
      >
        <ChevronDown size={16} className="mr-2" />
        Send Backward
      </div>
      <div
        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
        onClick={() => { onSendToBack?.(); onClose(); }}
        data-testid="context-menu-send-to-back"
      >
        <ArrowDown size={16} className="mr-2" />
        Send to Back
      </div>
      
      {onViewSemanticData && (
        <>
          <div className="border-t border-border my-1" />
          <div
            className="px-3 py-2 hover:bg-accent cursor-pointer text-sm text-muted-foreground flex items-center"
            onClick={() => { onViewSemanticData(); onClose(); }}
            data-testid="context-menu-view-semantic"
          >
            <Bug size={16} className="mr-2" />
            View Semantic Data (debug)
          </div>
        </>
      )}
      
      {/* Figma Frame Actions - Generate Workflow */}
      {node?.type === 'image' && node.data?.figmaSemantic && !node.data?.isReferenceFrame && onGenerateWorkflowFromFrames && (
        <>
          <div className="border-t border-border my-1" />
          <div
            className="px-3 py-2 hover:bg-accent cursor-pointer text-sm flex items-center text-primary"
            onClick={() => { onGenerateWorkflowFromFrames([node.id]); onClose(); }}
            data-testid="context-menu-generate-workflow"
          >
            <Workflow size={16} className="mr-2" />
            Generate Workflow from Frame
          </div>
        </>
      )}
      
      {/* Figma Frame Actions - Reference Frame Toggle */}
      {node?.type === 'image' && node.data?.figmaId && onToggleReferenceFrame && (
        <div
          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm flex items-center"
          onClick={() => { onToggleReferenceFrame(node.id); onClose(); }}
          data-testid="context-menu-toggle-reference"
        >
          {node.data?.isReferenceFrame ? (
            <>
              <BookmarkMinus size={16} className="mr-2" />
              Unmark as Reference Frame
            </>
          ) : (
            <>
              <Bookmark size={16} className="mr-2" />
              Mark as Reference Frame
            </>
          )}
        </div>
      )}
      
      {/* PRD Links - View linked PRD sections */}
      {prdLinks && prdLinks.length > 0 && onViewLinkedPRD && (
        <>
          <div className="border-t border-border my-1" />
          <div className="px-3 py-1 text-xs text-muted-foreground">Linked Spec Sections</div>
          {prdLinks.map((link, idx) => (
            <div
              key={`${link.workflowId}-${link.sectionId}-${idx}`}
              className="px-3 py-2 hover:bg-accent cursor-pointer text-sm flex items-center"
              onClick={() => { onViewLinkedPRD(link); onClose(); }}
              data-testid={`context-menu-view-prd-${link.sectionId}`}
            >
              <FileText size={16} className="mr-2 text-blue-500" />
              View: {link.sectionId}
            </div>
          ))}
        </>
      )}
      
      <div className="border-t border-border my-1" />
      <div
        className="px-3 py-2 hover:bg-destructive/10 cursor-pointer text-sm text-destructive"
        onClick={onDelete}
        data-testid="context-menu-delete"
      >
        <Trash2 size={16} className="mr-2" />
        Delete
      </div>
    </div>
  );
}
