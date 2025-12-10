import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2, Image, Layers } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { fetchFigmaThumbnails, type FigmaFrame } from '@/lib/integration/figmaApi';

interface FigmaFramePickerProps {
  isOpen: boolean;
  onClose: () => void;
  frames: FigmaFrame[];
  fileName: string;
  fileKey: string;
  patToken?: string;
  onSelect: (frames: FigmaFrame[]) => void;
  isLoading: boolean;
  error: string | null;
}

export function FigmaFramePicker({
  isOpen,
  onClose,
  frames,
  fileName,
  fileKey,
  patToken,
  onSelect,
  isLoading,
  error,
}: FigmaFramePickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [hoveredFrameId, setHoveredFrameId] = useState<string | null>(null);

  useEffect(() => {
    if (frames.length > 0) {
      setLoadingThumbnails(true);
      fetchFigmaThumbnails(fileKey, frames.map(f => f.id), patToken)
        .then((result) => {
          setThumbnails(result.images || {});
        })
        .catch((err) => {
          console.error('Failed to load thumbnails:', err);
        })
        .finally(() => {
          setLoadingThumbnails(false);
        });
    }
  }, [frames, fileKey, patToken]);

  const handleToggleFrame = useCallback((frameId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === frames.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(frames.map(f => f.id)));
    }
  }, [frames, selectedIds.size]);

  const handleImport = useCallback(() => {
    const selectedFrames = frames.filter(f => selectedIds.has(f.id));
    onSelect(selectedFrames);
  }, [frames, selectedIds, onSelect]);

  const groupedByPage = frames.reduce((acc, frame) => {
    if (!acc[frame.pageName]) {
      acc[frame.pageName] = [];
    }
    acc[frame.pageName].push(frame);
    return acc;
  }, {} as Record<string, FigmaFrame[]>);

  const previewFrame = hoveredFrameId 
    ? frames.find(f => f.id === hoveredFrameId) 
    : selectedIds.size > 0 
      ? frames.find(f => selectedIds.has(f.id))
      : frames[0];

  const previewThumbnail = previewFrame ? thumbnails[previewFrame.id] : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SiFigma className="h-5 w-5 text-[#F24E1E]" />
            Select Frames to Import
          </DialogTitle>
          <DialogDescription>
            {fileName} • {frames.length} frame{frames.length !== 1 ? 's' : ''} found
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 min-h-[400px]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {selectedIds.size === frames.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <ScrollArea className="h-[350px] border rounded-md p-2">
              {Object.entries(groupedByPage).map(([pageName, pageFrames]) => (
                <div key={pageName} className="mb-4">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                    <Layers size={14} />
                    {pageName}
                  </div>
                  <div className="space-y-1 ml-4">
                    {pageFrames.map((frame) => (
                      <div
                        key={frame.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedIds.has(frame.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleToggleFrame(frame.id)}
                        onMouseEnter={() => setHoveredFrameId(frame.id)}
                        onMouseLeave={() => setHoveredFrameId(null)}
                        data-testid={`frame-item-${frame.id}`}
                      >
                        <Checkbox
                          checked={selectedIds.has(frame.id)}
                          onCheckedChange={() => handleToggleFrame(frame.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {thumbnails[frame.id] ? (
                            <img
                              src={thumbnails[frame.id]!}
                              alt={frame.name}
                              className="w-full h-full object-cover"
                            />
                          ) : loadingThumbnails ? (
                            <Loader2 size={12} className="animate-spin text-muted-foreground" />
                          ) : (
                            <Image size={12} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{frame.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {frame.width} × {frame.height}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="w-[280px] flex-shrink-0">
            <div className="text-sm font-medium mb-2">Preview</div>
            <div className="border rounded-md bg-muted/30 h-[350px] flex items-center justify-center overflow-hidden">
              {previewThumbnail ? (
                <img
                  src={previewThumbnail}
                  alt={previewFrame?.name || 'Preview'}
                  className="max-w-full max-h-full object-contain"
                />
              ) : loadingThumbnails ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-sm">Loading preview...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Image size={32} />
                  <span className="text-sm">No preview available</span>
                </div>
              )}
            </div>
            {previewFrame && (
              <div className="mt-2 text-center">
                <div className="text-sm font-medium truncate">{previewFrame.name}</div>
                <div className="text-xs text-muted-foreground">
                  {previewFrame.width} × {previewFrame.height}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-frame-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || selectedIds.size === 0}
            className="bg-[#F24E1E] hover:bg-[#E04332] text-white"
            data-testid="button-import-frames"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <SiFigma size={14} className="mr-2" />
                Import {selectedIds.size > 0 ? `${selectedIds.size} Frame${selectedIds.size > 1 ? 's' : ''}` : 'Frames'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
