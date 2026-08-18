import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, X, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { parseFigmaUrl } from '@/lib/integration/figmaUrl';
import { fetchFigmaFile, fetchFigmaNode, fetchFigmaThumbnails } from '@/lib/integration/figmaApi';
import type { PromptAttachment } from '@/types/promptContext';

const PENDING_FIGMA_URL_KEY = 'kiteframe_pending_figma_url';

interface FigmaStatus {
  connected: boolean;
  oauthAvailable: boolean;
  message: string;
}

interface InlineFigmaImportProps {
  isExpanded: boolean;
  onToggle: () => void;
  onAttachmentAdd: (attachment: PromptAttachment) => void;
  isDisabled?: boolean;
  hasExistingFigma: boolean;
}

export function InlineFigmaImport({
  isExpanded,
  onToggle,
  onAttachmentAdd,
  isDisabled = false,
  hasExistingFigma,
}: InlineFigmaImportProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  const queryFigmaStatus = useCallback(() => {
    setStatusLoading(true);
    fetch('/api/figma/status', { credentials: 'include' })
      .then(res => res.json())
      .then((data: FigmaStatus) => {
        setFigmaStatus(data);
      })
      .catch(() => {
        setFigmaStatus({ connected: false, oauthAvailable: false, message: 'Could not check Figma status' });
      })
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    if (isExpanded) {
      queryFigmaStatus();
      // Restore pending URL after OAuth redirect
      const pendingUrl = localStorage.getItem(PENDING_FIGMA_URL_KEY);
      if (pendingUrl) {
        setUrl(pendingUrl);
        localStorage.removeItem(PENDING_FIGMA_URL_KEY);
      }
    }
  }, [isExpanded, queryFigmaStatus]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.figmaAuth === "success") {
        setOauthPending(false);
        queryFigmaStatus();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [queryFigmaStatus]);

  const handleOAuthConnect = useCallback(() => {
    if (figmaStatus?.connected) return;
    
    // Save pending URL before OAuth redirect so we can restore it
    if (url.trim()) {
      localStorage.setItem(PENDING_FIGMA_URL_KEY, url.trim());
    }
    
    setOauthPending(true);
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      '/api/figma/auth',
      'figma-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      setOauthPending(false);
      setError('Popup was blocked. Please allow popups for this site.');
      localStorage.removeItem(PENDING_FIGMA_URL_KEY);
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setTimeout(() => {
          if (oauthPending) {
            setOauthPending(false);
            queryFigmaStatus();
          }
        }, 500);
      }
    }, 500);
  }, [figmaStatus, oauthPending, queryFigmaStatus, url]);

  const handleAddFigma = useCallback(async () => {
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
      setError('Please enter a Figma URL');
      return;
    }

    if (!figmaStatus?.connected) {
      setError('Please connect to Figma first');
      return;
    }

    const parsed = parseFigmaUrl(trimmedUrl);
    if (!parsed) {
      setError('Invalid Figma URL. Please paste a valid Figma file or frame URL.');
      return;
    }

    setError(null);
    setIsLoading(true);

    const attachmentId = `figma-${Date.now()}`;

    try {
      let fileName = 'Figma Design';
      let thumbnailUrl: string | undefined;
      let nodeId = parsed.nodeId;

      if (parsed.nodeId) {
        const nodeData = await fetchFigmaNode(parsed.fileKey, parsed.nodeId);
        const nodeInfo = nodeData.nodes?.[parsed.nodeId];
        if (nodeInfo?.document) {
          fileName = nodeInfo.document.name || 'Figma Frame';
        }
        const thumbnails = await fetchFigmaThumbnails(parsed.fileKey, [parsed.nodeId]);
        thumbnailUrl = thumbnails.images?.[parsed.nodeId] || undefined;
      } else {
        const fileData = await fetchFigmaFile(parsed.fileKey);
        fileName = fileData.name || 'Figma File';
      }

      const attachment: PromptAttachment = {
        id: attachmentId,
        type: 'figma',
        displayName: fileName,
        thumbnailUrl,
        status: 'ready',
        metadata: {
          fileKey: parsed.fileKey,
          fileName,
          nodeId: nodeId || undefined,
        },
      };

      onAttachmentAdd(attachment);
      setUrl('');
      onToggle();
    } catch (err) {
      console.error('Figma fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Figma design';
      setError(errorMessage);
      
      if (errorMessage.includes('Reconnect') || errorMessage.includes('expired')) {
        queryFigmaStatus();
      }
    } finally {
      setIsLoading(false);
    }
  }, [url, figmaStatus, onAttachmentAdd, onToggle, queryFigmaStatus]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && figmaStatus?.connected) {
      e.preventDefault();
      handleAddFigma();
    }
    if (e.key === 'Escape') {
      onToggle();
    }
  }, [handleAddFigma, isLoading, figmaStatus, onToggle]);

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3" data-testid="inline-figma-import">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SiFigma className="w-4 h-4 text-[#F24E1E]" />
          Import from Figma
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted transition-colors"
          data-testid="button-close-figma-panel"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {statusLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking Figma connection...
        </div>
      ) : figmaStatus?.connected ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            Connected to Figma
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Paste Figma URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isDisabled}
              className="flex-1 h-9 text-sm"
              data-testid="input-figma-url"
            />
            <Button
              size="sm"
              onClick={handleAddFigma}
              disabled={isLoading || !url.trim() || isDisabled}
              data-testid="button-add-figma"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Connect your Figma account to import designs
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOAuthConnect}
            disabled={oauthPending || isDisabled}
            className="gap-2"
            data-testid="button-connect-figma"
          >
            {oauthPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Connect Figma Account
              </>
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
