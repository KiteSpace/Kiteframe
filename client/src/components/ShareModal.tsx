import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Loader2, Link } from 'lucide-react';
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
}

export function ShareModal({ isOpen, onClose, nodes, edges, canvasObjects, viewport, projectMetadata, onShareCreated }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateShareLink = async () => {
    setIsGenerating(true);
    try {
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
    setShareUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link className="w-5 h-5" />Share Workflow</DialogTitle>
          <DialogDescription>Generate a view-only link to share your workflow with others.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
          <p className="text-sm text-muted-foreground">Anyone with this link can view your workflow (read-only).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
