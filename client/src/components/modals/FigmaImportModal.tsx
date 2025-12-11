import { useState, useCallback, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Loader2, ExternalLink, Key, Link2, CheckCircle } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { parseFigmaUrl } from '@/lib/integration/figmaUrl';
import { 
  fetchFigmaFile, 
  fetchFigmaNode,
  fetchFigmaThumbnails, 
  fetchFigmaFrameTrees,
  discoverFrames,
  type FigmaFrame 
} from '@/lib/integration/figmaApi';
import { extractFigmaSemanticMetadata } from '@/lib/integration/figmaSemanticExtractor';
import type { FigmaSemanticMetadata } from '@/lib/integration/figmaSemanticTypes';
import { FigmaFramePicker } from './FigmaFramePicker';

export interface FigmaImportInfo {
  url: string;
  fileKey: string;
  fileName: string;
}

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (frames: Array<{ frame: FigmaFrame; thumbnailUrl: string | null; figmaSemantic?: FigmaSemanticMetadata | null }>, mode: 'new-project' | 'insert-into-project', figmaInfo?: FigmaImportInfo) => Promise<void> | void;
  mode: 'new-project' | 'insert-into-project';
}

interface FigmaStatus {
  connected: boolean;
  oauthAvailable: boolean;
  message: string;
}

type Step = 'input' | 'frame-selection';
type AuthMethod = 'pat' | 'oauth';

export function FigmaImportModal({
  isOpen,
  onClose,
  onImport,
  mode,
}: FigmaImportModalProps) {
  const [url, setUrl] = useState('');
  const [pat, setPat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('pat');
  
  const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  
  const [discoveredFrames, setDiscoveredFrames] = useState<FigmaFrame[]>([]);
  const [fileKey, setFileKey] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  const queryFigmaStatus = useCallback(() => {
    setStatusLoading(true);
    fetch('/api/figma/status', { credentials: 'include' })
      .then(res => res.json())
      .then((data: FigmaStatus) => {
        setFigmaStatus(data);
        if (data.connected) {
          setAuthMethod('oauth');
        }
      })
      .catch(() => {
        setFigmaStatus({ connected: false, oauthAvailable: false, message: 'Could not check Figma status' });
      })
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    if (isOpen) {
      queryFigmaStatus();
    }
  }, [isOpen, queryFigmaStatus]);

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

  const resetState = useCallback(() => {
    setUrl('');
    setPat('');
    setError(null);
    setIsLoading(false);
    setStep('input');
    setDiscoveredFrames([]);
    setFileKey('');
    setFileName('');
    setOauthPending(false);
  }, []);

  const handleContinue = useCallback(async () => {
    const trimmedUrl = url.trim();
    const trimmedPat = pat.trim();
    
    if (!trimmedUrl) {
      setError('Please enter a Figma URL');
      return;
    }

    if (!figmaStatus?.connected && !trimmedPat) {
      setError('Please enter your Personal Access Token or connect via OAuth');
      return;
    }

    const parsed = parseFigmaUrl(trimmedUrl);
    if (!parsed) {
      setError('Invalid Figma URL. Please paste a valid Figma file URL.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setFileKey(parsed.fileKey);

    const tokenToUse = figmaStatus?.connected ? undefined : trimmedPat;

    try {
      if (parsed.nodeId) {
        const nodeData = await fetchFigmaNode(parsed.fileKey, parsed.nodeId, tokenToUse);
        const nodeInfo = nodeData.nodes?.[parsed.nodeId];
        
        if (!nodeInfo?.document) {
          throw new Error('Frame not found in Figma file');
        }

        const frame: FigmaFrame = {
          id: parsed.nodeId,
          name: nodeInfo.document.name || 'Untitled',
          type: nodeInfo.document.type,
          pageName: 'Direct Import',
          width: nodeInfo.document.absoluteBoundingBox?.width || 800,
          height: nodeInfo.document.absoluteBoundingBox?.height || 600,
          absoluteBoundingBox: nodeInfo.document.absoluteBoundingBox,
        };

        const thumbnails = await fetchFigmaThumbnails(parsed.fileKey, [parsed.nodeId], tokenToUse);
        const thumbnailUrl = thumbnails.images?.[parsed.nodeId] || null;

        // Extract semantic metadata (graceful failure)
        let figmaSemantic: FigmaSemanticMetadata | null = null;
        try {
          if (nodeInfo.document) {
            figmaSemantic = extractFigmaSemanticMetadata(nodeInfo.document, 'Direct Import');
          }
        } catch (extractError) {
          console.warn('Failed to extract semantic data for direct import:', extractError);
        }

        await onImport([{ frame, thumbnailUrl, figmaSemantic }], mode, {
          url: trimmedUrl,
          fileKey: parsed.fileKey,
          fileName: frame.name
        });
        resetState();
        onClose();
      } else {
        const fileData = await fetchFigmaFile(parsed.fileKey, tokenToUse);
        setFileName(fileData.name || 'Untitled');
        
        const frames = discoverFrames(fileData);
        
        if (frames.length === 0) {
          throw new Error('No frames found in this Figma file. Please select a file with at least one frame.');
        }

        setDiscoveredFrames(frames);
        setStep('frame-selection');
      }
    } catch (err) {
      console.error('Figma import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Figma file');
    } finally {
      setIsLoading(false);
    }
  }, [url, pat, figmaStatus, onImport, onClose, mode, resetState]);

  const handleFrameSelect = useCallback(async (selectedFrames: FigmaFrame[]) => {
    if (selectedFrames.length === 0) return;

    setIsLoading(true);
    setError(null);

    const tokenToUse = figmaStatus?.connected ? undefined : pat.trim();

    try {
      // Fetch thumbnails and frame trees in parallel for efficiency
      const frameIds = selectedFrames.map(f => f.id);
      
      const [thumbnails, frameTrees] = await Promise.all([
        fetchFigmaThumbnails(fileKey, frameIds, tokenToUse),
        fetchFigmaFrameTrees(fileKey, frameIds, tokenToUse).catch(err => {
          console.warn('Failed to fetch frame trees for semantic extraction:', err);
          return {} as Record<string, { document: any }>;
        })
      ]);

      const framesWithThumbnails = selectedFrames.map(frame => {
        let figmaSemantic: FigmaSemanticMetadata | null = null;
        
        // Extract semantic metadata from frame tree (graceful failure)
        try {
          const frameTree = frameTrees[frame.id];
          if (frameTree?.document) {
            figmaSemantic = extractFigmaSemanticMetadata(frameTree.document, frame.pageName);
          }
        } catch (extractError) {
          console.warn(`Failed to extract semantic data for frame ${frame.id}:`, extractError);
        }
        
        return {
          frame,
          thumbnailUrl: thumbnails.images?.[frame.id] || null,
          figmaSemantic,
        };
      });

      await onImport(framesWithThumbnails, mode, {
        url: url.trim(),
        fileKey,
        fileName
      });
      resetState();
      onClose();
    } catch (err) {
      console.error('Error importing frames:', err);
      setError(err instanceof Error ? err.message : 'Failed to import frames');
    } finally {
      setIsLoading(false);
    }
  }, [fileKey, pat, figmaStatus, onImport, onClose, mode, resetState]);

  const handleOAuthConnect = useCallback(() => {
    if (figmaStatus?.connected) return;
    
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
  }, [figmaStatus, oauthPending, queryFigmaStatus]);

  const handleClose = useCallback(() => {
    if (!isLoading && !oauthPending) {
      resetState();
      onClose();
    }
  }, [isLoading, oauthPending, onClose, resetState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && step === 'input') {
      e.preventDefault();
      handleContinue();
    }
  }, [handleContinue, isLoading, step]);

  if (step === 'frame-selection') {
    const tokenForPicker = figmaStatus?.connected ? undefined : pat;
    return (
      <FigmaFramePicker
        isOpen={isOpen}
        onClose={handleClose}
        frames={discoveredFrames}
        fileName={fileName}
        fileKey={fileKey}
        patToken={tokenForPicker}
        onSelect={handleFrameSelect}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  const isConnected = figmaStatus?.connected === true;
  const showAuthSection = !isConnected;
  const showTabs = showAuthSection && (figmaStatus?.oauthAvailable || false);
  const canProceed = url.trim() && (isConnected || pat.trim());

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
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
          {isConnected && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
              <CheckCircle size={16} />
              Connected to Figma via OAuth
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="figma-url">Figma File URL</Label>
            <Input
              id="figma-url"
              placeholder="https://www.figma.com/file/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading || oauthPending}
              data-testid="input-figma-url"
            />
            <p className="text-xs text-muted-foreground">
              Paste a Figma file URL. If it includes a node-id parameter, that specific frame will be imported directly.
            </p>
          </div>

          {statusLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Checking connection...
            </div>
          ) : showAuthSection && (
            showTabs ? (
              <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="oauth" className="flex items-center gap-2">
                    <Link2 size={14} />
                    OAuth
                  </TabsTrigger>
                  <TabsTrigger value="pat" className="flex items-center gap-2">
                    <Key size={14} />
                    Access Token
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="oauth" className="space-y-3 pt-2">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect your Figma account to import files without a Personal Access Token.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleOAuthConnect}
                      disabled={oauthPending}
                      className="w-full"
                      data-testid="button-figma-oauth"
                    >
                      {oauthPending ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <SiFigma className="mr-2 h-4 w-4" />
                          Connect Figma Account
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="pat" className="space-y-2 pt-2">
                  <Label htmlFor="figma-pat" className="flex items-center gap-2">
                    <Key size={14} />
                    Personal Access Token
                  </Label>
                  <Input
                    id="figma-pat"
                    type="password"
                    placeholder="figd_xxxxxxxxxxxx"
                    value={pat}
                    onChange={(e) => {
                      setPat(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading || oauthPending}
                    data-testid="input-figma-pat"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>Your token is used only for this import and never stored.</span>
                    <a
                      href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      How to get this
                      <ExternalLink size={10} />
                    </a>
                  </p>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="figma-pat" className="flex items-center gap-2">
                  <Key size={14} />
                  Personal Access Token
                </Label>
                <Input
                  id="figma-pat"
                  type="password"
                  placeholder="figd_xxxxxxxxxxxx"
                  value={pat}
                  onChange={(e) => {
                    setPat(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading || oauthPending}
                  data-testid="input-figma-pat"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>Your token is used only for this import and never stored.</span>
                  <a
                    href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    How to get this
                    <ExternalLink size={10} />
                  </a>
                </p>
              </div>
            )
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading || oauthPending}
            data-testid="button-figma-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isLoading || oauthPending || !canProceed}
            className="bg-[#F24E1E] hover:bg-[#E04332] text-white"
            data-testid="button-figma-continue"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
