import { useEffect, useState } from "react";
import { Link as LinkIcon, Copy, Check, Loader2, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface DesignShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  designId: string;
  /** Current share uuid, or null when the design has never been shared. */
  shareUuid: string | null;
  isShareEnabled: boolean;
}

const shareUrlFor = (uuid: string) => `${window.location.origin}/design-view/${uuid}`;

/**
 * View-only sharing for an Interface, mirroring the workflow-project ShareModal:
 * a link the owner can generate, copy, and revoke.
 */
export function DesignShareModal({
  isOpen,
  onClose,
  designId,
  shareUuid,
  isShareEnabled,
}: DesignShareModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reflect the design's persisted share state whenever the dialog opens, so a
  // link generated in an earlier session shows up instead of a stale null.
  useEffect(() => {
    if (!isOpen) return;
    setShareUrl(isShareEnabled && shareUuid ? shareUrlFor(shareUuid) : null);
    setCopied(false);
  }, [isOpen, isShareEnabled, shareUuid]);

  const generateShareLink = async () => {
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", `/api/designs/${designId}/share`, {});
      const data = await res.json();
      setShareUrl(shareUrlFor(data.shareUuid));
      // Prefix key: refreshes this design AND the grid's Interface list, so a
      // link generated here shows up as "Shared" on the project tile too.
      qc.invalidateQueries({ queryKey: ["/api/designs"] });
    } catch {
      toast({
        title: "Could not create link",
        description: "Something went wrong enabling sharing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeShareLink = async () => {
    setIsRevoking(true);
    try {
      await apiRequest("DELETE", `/api/designs/${designId}/share`);
      setShareUrl(null);
      qc.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({
        title: "Sharing disabled",
        description: "This Interface is now private. Existing links will no longer work.",
      });
    } catch {
      toast({
        title: "Could not disable sharing",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Copied!", description: "Share link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Share Interface
          </DialogTitle>
          <DialogDescription>
            Share this Interface with a view-only link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <Button
              onClick={generateShareLink}
              disabled={isGenerating}
              className="w-full"
              data-testid="button-generate-design-share-link"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                "Generate Share Link"
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="flex-1" data-testid="input-design-share-url" />
                <Button onClick={copyToClipboard} variant="outline" size="icon" data-testid="button-copy-design-share-link">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                onClick={revokeShareLink}
                disabled={isRevoking}
                variant="outline"
                className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                data-testid="button-revoke-design-share-link"
              >
                {isRevoking ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Disabling...</>
                ) : (
                  <><EyeOff className="w-4 h-4 mr-2" />Stop sharing</>
                )}
              </Button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Anyone with this link can view this Interface, but not edit it. They
            will always see the latest version.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
