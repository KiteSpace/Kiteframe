import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { parseFigmaUrl } from '@/lib/integration/figmaUrl';

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (figmaUrl: string, mode: 'new-project' | 'insert-into-project') => Promise<void> | void;
  mode: 'new-project' | 'insert-into-project';
}

export function FigmaImportModal({
  isOpen,
  onClose,
  onImport,
  mode,
}: FigmaImportModalProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = useCallback(async () => {
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
      setError('Please enter a Figma URL');
      return;
    }

    const parsed = parseFigmaUrl(trimmedUrl);
    if (!parsed) {
      setError('Invalid Figma URL. Please paste a valid Figma file or frame URL.');
      return;
    }

    setError(null);
    setIsImporting(true);

    try {
      await onImport(trimmedUrl, mode);
      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import Figma design');
    } finally {
      setIsImporting(false);
    }
  }, [url, onImport, onClose, mode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isImporting) {
      e.preventDefault();
      handleImport();
    }
  }, [handleImport, isImporting]);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      setUrl('');
      setError(null);
      onClose();
    }
  }, [isImporting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SiFigma className="h-5 w-5 text-[#F24E1E]" />
            Import from Figma
          </DialogTitle>
          <DialogDescription>
            {mode === 'new-project'
              ? 'Create a new project from a Figma design'
              : 'Add a Figma design to your current workflow'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="figma-url">Figma URL</Label>
            <Input
              id="figma-url"
              placeholder="https://www.figma.com/file/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isImporting}
              data-testid="input-figma-url"
            />
            <p className="text-xs text-muted-foreground">
              Paste a Figma file or frame URL (e.g., figma.com/file/abc123 or figma.com/design/abc123?node-id=1-2)
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isImporting}
            data-testid="button-figma-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || !url.trim()}
            className="bg-[#F24E1E] hover:bg-[#E04332] text-white"
            data-testid="button-figma-import"
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <SiFigma size={14} className="mr-2" />
                Import
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
