import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, X, ImageIcon, AlertCircle, Check } from "lucide-react";
import { SiFigma } from "react-icons/si";
import { parseFigmaUrl } from "@/lib/integration/figmaUrl";
import { callFigmaApi, discoverFrames, type FigmaFrame } from "@/lib/integration/figmaApi";

type ImportTab = "screenshot" | "figma";
type FigmaStep = "url" | "frames";

export interface ImportDesignModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (craftStateStr: string, message?: string) => void;
  currentCraftState?: string;
}

export function ImportDesignModal({ open, onClose, onImport, currentCraftState }: ImportDesignModalProps) {
  const [tab, setTab] = useState<ImportTab>("screenshot");

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-semibold">Import design</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ImportTab)} className="flex-1">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10 px-5 justify-start gap-1">
            <TabsTrigger
              value="screenshot"
              className="text-xs px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <ImageIcon size={13} />
              Screenshot
            </TabsTrigger>
            <TabsTrigger
              value="figma"
              className="text-xs px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <SiFigma size={11} />
              Figma
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screenshot" className="m-0">
            <ScreenshotTab
              currentCraftState={currentCraftState}
              onImport={onImport}
              onClose={handleClose}
            />
          </TabsContent>

          <TabsContent value="figma" className="m-0">
            <FigmaTab
              currentCraftState={currentCraftState}
              onImport={onImport}
              onClose={handleClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Screenshot tab ────────────────────────────────────────────────────────────

interface ScreenshotTabProps {
  currentCraftState?: string;
  onImport: (craftStateStr: string, message?: string) => void;
  onClose: () => void;
}

function ScreenshotTab({ currentCraftState, onImport, onClose }: ScreenshotTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WebP, GIF)");
      return;
    }
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const handleImport = async () => {
    if (!file || !preview) return;
    setIsLoading(true);
    setError(null);
    try {
      const base64 = preview.split(",")[1];
      const mimeType = file.type || "image/png";
      const res = await fetch("/api/ai/design-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          frameLabel: file.name.replace(/\.[^.]+$/, "") || "Screen 1",
          currentCraftState,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.type === "message") {
        setError(data.text || "AI couldn't generate a design from this image");
        return;
      }
      onImport(data.craftState, data.message);
      onClose();
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      {!preview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-[200px] ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Upload size={20} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop a screenshot here</p>
            <p className="text-xs text-muted-foreground mt-0.5">or click to browse · PNG, JPG, WebP, GIF</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
          />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
          <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
          <button
            onClick={() => { setFile(null); setPreview(null); setError(null); }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={!file || isLoading}
          className="gap-1.5"
        >
          {isLoading ? (
            <><Loader2 size={13} className="animate-spin" />Analyzing…</>
          ) : (
            <><Upload size={13} />Import</>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        KiteAI will analyze the screenshot and map it to Astryx components. Results are approximate.
      </p>
    </div>
  );
}

// ── Figma tab ─────────────────────────────────────────────────────────────────

interface FigmaTabProps {
  currentCraftState?: string;
  onImport: (craftStateStr: string, message?: string) => void;
  onClose: () => void;
}

function FigmaTab({ currentCraftState, onImport, onClose }: FigmaTabProps) {
  const [step, setStep] = useState<FigmaStep>("url");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [patToken, setPatToken] = useState("");
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [figmaConnected, setFigmaConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/figma/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setFigmaConnected(!!d.connected))
      .catch(() => setFigmaConnected(false));
  }, []);

  const handleLoadFrames = async () => {
    setError(null);
    const parsed = parseFigmaUrl(figmaUrl.trim());
    if (!parsed?.fileKey) {
      setError("Couldn't parse that Figma URL. Paste the full URL from Figma.");
      return;
    }
    const key = parsed.fileKey;
    setFileKey(key);
    setIsLoadingFrames(true);
    try {
      const token = patToken.trim() || null;
      const fileData = await callFigmaApi(`files/${key}?depth=2`, token);
      const discovered = discoverFrames(fileData);
      if (discovered.length === 0) {
        setError("No frames found in this file. Make sure you have top-level frames on a page.");
        return;
      }
      setFrames(discovered);
      setSelectedIds(new Set(discovered.slice(0, 4).map((f) => f.id)));
      setStep("frames");
    } catch (e: any) {
      setError(e.message || "Failed to load Figma file");
    } finally {
      setIsLoadingFrames(false);
    }
  };

  const toggleFrame = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 8) {
        next.add(id);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!fileKey || selectedIds.size === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/design-from-figma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileKey,
          frameIds: Array.from(selectedIds),
          patToken: patToken.trim() || undefined,
          currentCraftState,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onImport(data.craftState, data.message);
      onClose();
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  if (step === "url") {
    return (
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Figma file URL</label>
          <input
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLoadFrames(); }}
            placeholder="https://www.figma.com/file/…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        {figmaConnected === false && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Personal Access Token
              <span className="text-muted-foreground font-normal ml-1">(no Figma account connected)</span>
            </label>
            <input
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              placeholder="figd_••••••••••••••••"
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Get a token from Figma → Settings → Personal access tokens.
            </p>
          </div>
        )}

        {figmaConnected === true && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} />
            Figma connected via OAuth
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleLoadFrames}
            disabled={!figmaUrl.trim() || isLoadingFrames}
            className="gap-1.5"
          >
            {isLoadingFrames ? (
              <><Loader2 size={13} className="animate-spin" />Loading…</>
            ) : (
              <><SiFigma size={11} />Load frames</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // step === "frames"
  const grouped: Record<string, FigmaFrame[]> = {};
  for (const f of frames) {
    (grouped[f.pageName] = grouped[f.pageName] || []).push(f);
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Select up to 8 frames to import <span className="font-medium text-foreground">({selectedIds.size} selected)</span>
        </p>
        <button
          onClick={() => { setStep("url"); setError(null); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Change file
        </button>
      </div>

      <ScrollArea className="h-64 rounded-lg border border-border">
        <div className="p-2 space-y-3">
          {Object.entries(grouped).map(([page, pageFrames]) => (
            <div key={page}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1.5">{page}</p>
              <div className="space-y-1">
                {pageFrames.map((frame) => {
                  const isSelected = selectedIds.has(frame.id);
                  const isDisabled = !isSelected && selectedIds.size >= 8;
                  return (
                    <button
                      key={frame.id}
                      onClick={() => toggleFrame(frame.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors text-sm ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-accent border border-transparent"
                      } ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {isSelected && <Check size={10} className="text-primary-foreground" />}
                      </div>
                      <span className="flex-1 truncate text-foreground font-medium text-[13px]">{frame.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {Math.round(frame.width)}×{Math.round(frame.height)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isImporting}>Cancel</Button>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={selectedIds.size === 0 || isImporting}
          className="gap-1.5"
        >
          {isImporting ? (
            <><Loader2 size={13} className="animate-spin" />Importing…</>
          ) : (
            <><SiFigma size={11} />Import {selectedIds.size} frame{selectedIds.size !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        KiteAI will render each frame and map it to Astryx components. This may take a moment.
      </p>
    </div>
  );
}
