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
import { AlertCircle, Loader2, ExternalLink, Key, Link2 } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { parseFigmaUrl } from '@/lib/integration/figmaUrl';
import { 
  fetchFigmaFile, 
  fetchFigmaNode,
  fetchFigmaThumbnails, 
  discoverFrames,
  type FigmaFrame 
} from '@/lib/integration/figmaApi';
import { FigmaFramePicker } from './FigmaFramePicker';

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (frames: Array<{ frame: FigmaFrame; thumbnailUrl: string | null }>, mode: 'new-project' | 'insert-into-project') => Promise<void> | void;
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
  
  const [discoveredFrames, setDiscoveredFrames] = useState<FigmaFrame[]>([]);
  const [fileKey, setFileKey] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setStatusLoading(true);
      fetch('/api/figma/status')
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
    }
  }, [isOpen]);

  const resetState = useCallback(() => {
    setUrl('');
    setPat('');
    setError(null);
    setIsLoading(false);
    setStep('input');
    setDiscoveredFrames([]);
    setFileKey('');
    setFileName('');
  }, []);

  const handleContinue = useCallback(async () => {
    const trimmedUrl = url.trim();
    const trimmedPat = pat.trim();
    
    if (!trimmedUrl) {
      setError('Please enter a Figma URL');
      return;
    }

    if (authMethod === 'pat' && !trimmedPat) {
      setError('Please enter your Personal Access Token');
      return;
    }

    if (authMethod === 'oauth' && !figmaStatus?.connected) {
      setError('Please connect your Figma account first or switch to using a Personal Access Token');
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

    const tokenToUse = authMethod === 'oauth' && figmaStatus?.connected ? undefined : trimmedPat;

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

        await onImport([{ frame, thumbnailUrl }], mode);
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
  }, [url, pat, authMethod, figmaStatus, onImport, onClose, mode, resetState]);

  const handleFrameSelect = useCallback(async (selectedFrames: FigmaFrame[]) => {
    if (selectedFrames.length === 0) return;

    setIsLoading(true);
    setError(null);

    const tokenToUse = authMethod === 'oauth' && figmaStatus?.connected ? undefined : pat.trim();

    try {
      const thumbnails = await fetchFigmaThumbnails(
        fileKey,
        selectedFrames.map(f => f.id),
        tokenToUse
      );

      const framesWithThumbnails = selectedFrames.map(frame => ({
        frame,
        thumbnailUrl: thumbnails.images?.[frame.id] || null,
      }));

      await onImport(framesWithThumbnails, mode);
      resetState();
      onClose();
    } catch (err) {
      console.error('Error importing frames:', err);
      setError(err instanceof Error ? err.message : 'Failed to import frames');
    } finally {
      setIsLoading(false);
    }
  }, [fileKey, pat, authMethod, figmaStatus, onImport, onClose, mode, resetState]);

  const handleOAuthConnect = useCallback(() => {
    window.location.href = '/api/figma/auth';
  }, []);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      resetState();
      onClose();
    }
  }, [isLoading, onClose, resetState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && step === 'input') {
      e.preventDefault();
      handleContinue();
    }
  }, [handleContinue, isLoading, step]);

  if (step === 'frame-selection') {
    const tokenForPicker = authMethod === 'oauth' && figmaStatus?.connected ? undefined : pat;
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

  const showTabs = figmaStatus?.oauthAvailable || figmaStatus?.connected;
  const canProceed = url.trim() && (authMethod === 'oauth' ? figmaStatus?.connected : pat.trim());

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
              disabled={isLoading}
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
          ) : showTabs ? (
            <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="oauth" className="flex items-center gap-2">
                  <Link2 size={14} />
                  OAuth
                  {figmaStatus?.connected && <span className="text-xs text-green-500">(Connected)</span>}
                </TabsTrigger>
                <TabsTrigger value="pat" className="flex items-center gap-2">
                  <Key size={14} />
                  Access Token
                </TabsTrigger>
              </TabsList>

              <TabsContent value="oauth" className="space-y-3 pt-2">
                {figmaStatus?.connected ? (
                  <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
                    You're connected to Figma via OAuth. Your session token will be used automatically.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect your Figma account to import files without a Personal Access Token.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleOAuthConnect}
                      className="w-full"
                      data-testid="button-figma-oauth"
                    >
                      <SiFigma className="mr-2 h-4 w-4" />
                      Connect Figma Account
                    </Button>
                  </div>
                )}
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
                  disabled={isLoading}
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
                disabled={isLoading}
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
            disabled={isLoading}
            data-testid="button-figma-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isLoading || !canProceed}
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
