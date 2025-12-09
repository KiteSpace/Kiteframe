import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Loader2, Link, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[];
  edges: any[];
  canvasObjects?: any[];
  viewport?: { x: number; y: number; zoom: number };
  projectMetadata?: { name?: string; description?: string };
  onShareCreated?: (shareId: string) => void;
  projectId?: number | null;
  existingShareUuid?: string | null;
  isAuthenticated?: boolean;
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  nodes, 
  edges, 
  canvasObjects, 
  viewport, 
  projectMetadata, 
  onShareCreated,
  projectId,
  existingShareUuid,
  isAuthenticated = false
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && existingShareUuid) {
      setShareUrl(`${window.location.origin}/view/${existingShareUuid}`);
    }
  }, [isOpen, existingShareUuid]);

  const generateShareLink = async () => {
    setIsGenerating(true);
    try {
      if (projectId && isAuthenticated) {
        const response = await apiRequest('POST', `/api/projects/${projectId}/share`, {});
        const data = await response.json();
        const url = `${window.location.origin}/view/${data.shareUuid}`;
        setShareUrl(url);
        onShareCreated?.(data.shareUuid);
      } else {
        const response = await apiRequest('POST', '/api/share-project', {
          nodes,
          edges,
          canvasObjects: canvasObjects || [],
          viewport: viewport || { x: 0, y: 0, zoom: 1 },
          projectMetadata
        });
        const data = await response.json();
        const url = `${window.location.origin}/view/${data.shareId}`;
        setShareUrl(url);
        onShareCreated?.(data.shareId);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate share link', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Share link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (!existingShareUuid) {
      setShareUrl(null);
    }
    setCopied(false);
    onClose();
  };

  const showSaveProjectMessage = !projectId && isAuthenticated;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link className="w-5 h-5" />Share Workflow</DialogTitle>
          <DialogDescription>
            {projectId && isAuthenticated 
              ? 'Share your saved project with a view-only link.'
              : 'Generate a view-only link to share your workflow with others.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {showSaveProjectMessage && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-muted-foreground">
                Save your project first to get a permanent share link that stays updated. 
                Otherwise, this will create a snapshot link.
              </p>
            </div>
          )}
          {!shareUrl ? (
            <Button onClick={generateShareLink} disabled={isGenerating} className="w-full" data-testid="button-generate-share-link">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : 'Generate Share Link'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="flex-1" data-testid="input-share-url" />
              <Button onClick={copyToClipboard} variant="outline" size="icon" data-testid="button-copy-share-link">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {projectId && isAuthenticated 
              ? 'Viewers will always see the latest version of your project.'
              : 'Anyone with this link can view your workflow (read-only).'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
