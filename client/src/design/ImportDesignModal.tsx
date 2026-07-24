import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, X, ImageIcon, AlertCircle, Check, Link, Link2, CheckCircle, Key } from "lucide-react";
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

type ScreenshotInputMode = "upload" | "url";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_DIM_PX = 200; // warn below this width
const MAX_RESIZE_PX = 1920; // resize target max dimension

async function resizeImageDataUrl(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to load image for resize"));
    img.src = dataUrl;
  });
}

function ScreenshotTab({ currentCraftState, onImport, onClose }: ScreenshotTabProps) {
  const [inputMode, setInputMode] = useState<ScreenshotInputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WebP, GIF)");
      return;
    }
    setFile(f);
    setError(null);
    setWarn(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      const img = new Image();
      img.onload = () => {
        const warnings: string[] = [];
        if (f.size > MAX_FILE_BYTES) {
          const mb = (f.size / 1024 / 1024).toFixed(1);
          warnings.push(`Image is ${mb} MB — it will be resized to ${MAX_RESIZE_PX}px before sending.`);
        }
        if (img.width < MIN_DIM_PX) {
          warnings.push(`Image is very small (${img.width}px wide) — results may be poor.`);
        }
        setWarn(warnings.length ? warnings.join(" ") : null);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const handleImportFile = async () => {
    if (!file || !preview) return;
    setIsLoading(true);
    setError(null);
    try {
      let finalDataUrl = preview;
      if (file.size > MAX_FILE_BYTES) {
        finalDataUrl = await resizeImageDataUrl(preview, MAX_RESIZE_PX);
      }
      const base64 = finalDataUrl.split(",")[1];
      const mimeType = finalDataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : (file.type || "image/png");
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

  const handleImportUrl = async () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/design-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl: trimmed, currentCraftState }),
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

  const switchMode = (mode: ScreenshotInputMode) => {
    setInputMode(mode);
    setError(null);
    setWarn(null);
    setFile(null);
    setPreview(null);
    setImageUrl("");
  };

  const canImport = inputMode === "upload" ? !!file : imageUrl.trim().length > 0;

  return (
    <div className="p-5 space-y-4">
      <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
        <button
          onClick={() => switchMode("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            inputMode === "upload"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload size={12} />
          Upload file
        </button>
        <button
          onClick={() => switchMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            inputMode === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link size={12} />
          Paste URL
        </button>
      </div>

      {inputMode === "upload" ? (
        <>
          {!preview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-[180px] ${
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
                onClick={() => { setFile(null); setPreview(null); setError(null); setWarn(null); }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Image URL</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && imageUrl.trim()) handleImportUrl(); }}
            placeholder="https://example.com/screenshot.png"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Supports direct image links from Loom, Notion, Slack, and most image hosts.
          </p>
        </div>
      )}

      {warn && !error && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0" />
          {warn}
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
          onClick={inputMode === "upload" ? handleImportFile : handleImportUrl}
          disabled={!canImport || isLoading}
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
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; frameName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [figmaStatus, setFigmaStatus] = useState<{ connected: boolean; oauthAvailable: boolean } | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  const queryFigmaStatus = useCallback(() => {
    fetch("/api/figma/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setFigmaStatus({ connected: !!d.connected, oauthAvailable: !!d.oauthAvailable }))
      .catch(() => setFigmaStatus({ connected: false, oauthAvailable: false }));
  }, []);

  useEffect(() => { queryFigmaStatus(); }, [queryFigmaStatus]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.figmaAuth === "success") {
        setOauthPending(false);
        queryFigmaStatus();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [queryFigmaStatus]);

  const handleOAuthConnect = useCallback(() => {
    if (figmaStatus?.connected) return;
    setOauthPending(true);
    const w = 600, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open("/api/figma/auth", "figma-oauth", `width=${w},height=${h},left=${left},top=${top},popup=1`);
    if (!popup) { setOauthPending(false); setError("Popup was blocked. Please allow popups for this site."); return; }
    const check = setInterval(() => {
      if (popup.closed) {
        clearInterval(check);
        setTimeout(() => { setOauthPending(false); queryFigmaStatus(); }, 500);
      }
    }, 500);
  }, [figmaStatus, queryFigmaStatus]);

  const handleDisconnect = useCallback(async () => {
    await fetch("/api/figma/disconnect", { method: "POST", credentials: "include" });
    setFigmaStatus((prev) => prev ? { ...prev, connected: false } : null);
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
      const token = figmaStatus?.connected ? undefined : (patToken.trim() || null);
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
    setImportProgress(null);
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || "Import failed");
      }

      // Parse the SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.trim().split("\n");
          let eventName = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          let payload: any;
          try { payload = JSON.parse(dataStr); } catch { continue; }

          if (eventName === "progress") {
            setImportProgress({ done: payload.done, total: payload.total, frameName: payload.frameName });
          } else if (eventName === "complete") {
            onImport(payload.craftState, payload.message);
            onClose();
            return;
          } else if (eventName === "error") {
            throw new Error(payload.error || "Import failed");
          }
        }
      }
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
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

        {figmaStatus?.connected ? (
          <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={13} />
              Connected to Figma via OAuth
            </div>
            <button
              onClick={handleDisconnect}
              className="text-emerald-700/60 dark:text-emerald-400/60 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {figmaStatus?.oauthAvailable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOAuthConnect}
                disabled={oauthPending}
                className="w-full gap-2"
              >
                {oauthPending ? (
                  <><Loader2 size={13} className="animate-spin" />Connecting…</>
                ) : (
                  <><SiFigma size={13} />Connect Figma account</>
                )}
              </Button>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Key size={11} />
                {figmaStatus?.oauthAvailable ? "Or use a Personal Access Token" : "Personal Access Token"}
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

      {isImporting && importProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate max-w-[70%]">
              Importing <span className="font-medium text-foreground">{importProgress.frameName}</span>
            </span>
            <span>{importProgress.done} of {importProgress.total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isImporting && !importProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Preparing frames…</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/40 animate-pulse w-1/3" />
          </div>
        </div>
      )}

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
            <><Loader2 size={13} className="animate-spin" />{importProgress ? `${importProgress.done} of ${importProgress.total} done…` : "Starting…"}</>
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
