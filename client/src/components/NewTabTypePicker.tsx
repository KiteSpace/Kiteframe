import { useEffect, useRef, useState } from "react";
import { GitBranch, Layers, X, Sparkles, PenTool, ArrowLeft, Loader2, Upload } from "lucide-react";
import { ImportDesignModal } from "@/design/ImportDesignModal";

type Step = "pick-type" | "pick-design-mode" | "generate-design";

interface NewTabTypePickerProps {
  onSelectWorkflow: () => void;
  onSelectDesign?: () => void;
  onOpenDesignById: (designId: string, title?: string) => void;
  onCancel: () => void;
}

export function NewTabTypePicker({
  onSelectWorkflow,
  onOpenDesignById,
  onCancel,
}: NewTabTypePickerProps) {
  const [step, setStep] = useState<Step>("pick-type");
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step === "generate-design") setStep("pick-design-mode");
        else if (step === "pick-design-mode") setStep("pick-type");
        else onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, step]);

  // Auto-focus the prompt textarea when entering generate-design step
  useEffect(() => {
    if (step === "generate-design") {
      setTimeout(() => promptRef.current?.focus(), 50);
    }
  }, [step]);

  const handleBlankCanvas = async () => {
    setIsCreatingBlank(true);
    try {
      const resp = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source: "native" }),
      });
      if (resp.ok) {
        const data = await resp.json();
        onOpenDesignById(data.id, data.title ?? undefined);
      } else {
        console.error("[NewTabTypePicker] Failed to create blank design, status:", resp.status);
        setIsCreatingBlank(false);
      }
    } catch (err) {
      console.error("[NewTabTypePicker] Failed to create blank design:", err);
      setIsCreatingBlank(false);
    }
  };

  const handleGenerateDesign = async () => {
    if (!prompt.trim() || isGenerating) return;
    setGenerateError(null);
    setIsGenerating(true);
    try {
      const genRes = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.message || genData.error || "Generation failed");

      const createRes = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ craftState: genData.craftState, source: "tab-ai" }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message || createData.error || "Failed to save design");

      onOpenDesignById(createData.id, createData.title ?? prompt.trim());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setGenerateError(msg || "Couldn't generate that layout — try rephrasing");
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center relative bg-background"
      data-testid="new-tab-type-picker"
    >
      {/* click-away backdrop */}
      <div className="absolute inset-0 z-0" onClick={onCancel} />

      {/* foreground content — stopPropagation so backdrop click doesn't fire */}
      <div
        className="relative z-10 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute -top-10 right-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Cancel"
          data-testid="button-new-tab-cancel"
        >
          <X size={16} />
        </button>

        {step === "pick-type" ? (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground">What are you creating?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Choose a project type to get started</p>
            </div>

            <div className="flex gap-6">
              <button
                onClick={onSelectWorkflow}
                className="group flex flex-col items-center gap-4 w-48 p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all cursor-pointer text-left"
                data-testid="button-new-tab-workflow"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition-colors">
                  <GitBranch className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">Workflow</div>
                  <div className="text-xs text-muted-foreground mt-1">Map a process or system flow</div>
                </div>
              </button>

              <button
                onClick={() => setStep("pick-design-mode")}
                className="group flex flex-col items-center gap-4 w-48 p-8 rounded-2xl border-2 border-border bg-card hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer text-left"
                data-testid="button-new-tab-design"
              >
                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900 transition-colors">
                  <Layers className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">Design</div>
                  <div className="text-xs text-muted-foreground mt-1">Sketch a UI screen or component</div>
                </div>
              </button>
            </div>
          </>
        ) : step === "pick-design-mode" ? (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground">How would you like to start?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Generate from a description or start with a blank canvas</p>
            </div>

            <div className="flex gap-6 flex-wrap justify-center">
              <button
                onClick={() => setStep("generate-design")}
                className="group flex flex-col items-center gap-4 w-44 p-7 rounded-2xl border-2 border-border bg-card hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer text-left"
                data-testid="button-new-tab-design-ai"
              >
                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900 transition-colors">
                  <Sparkles className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">Generate with AI</div>
                  <div className="text-xs text-muted-foreground mt-1">Describe your UI and let KiteAI build it</div>
                </div>
              </button>

              <button
                onClick={handleBlankCanvas}
                disabled={isCreatingBlank}
                className="group flex flex-col items-center gap-4 w-44 p-7 rounded-2xl border-2 border-border bg-card hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer text-left disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="button-new-tab-design-blank"
              >
                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900 transition-colors">
                  <PenTool className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">
                    {isCreatingBlank ? "Creating…" : "Blank canvas"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Drag-and-drop components yourself</div>
                </div>
              </button>

              <button
                onClick={() => setImportModalOpen(true)}
                className="group flex flex-col items-center gap-4 w-44 p-7 rounded-2xl border-2 border-border bg-card hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer text-left"
                data-testid="button-new-tab-design-import"
              >
                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900 transition-colors">
                  <Upload className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground">Import design</div>
                  <div className="text-xs text-muted-foreground mt-1">From a screenshot or Figma file</div>
                </div>
              </button>
            </div>

            <ImportDesignModal
              open={importModalOpen}
              onClose={() => setImportModalOpen(false)}
              onImport={async (craftStateStr) => {
                try {
                  const createRes = await fetch("/api/designs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ craftState: craftStateStr, source: "import" }),
                  });
                  const createData = await createRes.json();
                  if (!createRes.ok) throw new Error(createData.error || "Failed to save design");
                  setImportModalOpen(false);
                  onOpenDesignById(createData.id, createData.title ?? "Imported Design");
                } catch (e) {
                  console.error("[NewTabTypePicker] Import create failed:", e);
                }
              }}
            />

            <button
              onClick={() => setStep("pick-type")}
              className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={12} />
              Back
            </button>
          </>
        ) : (
          /* generate-design step */
          <div className="flex flex-col items-center w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Describe your design</h2>
              <p className="text-muted-foreground mt-2 text-sm">KiteAI will build a component or screen from your description</p>
            </div>

            <div className="w-full space-y-3">
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerateDesign();
                  }
                }}
                placeholder="e.g. A dashboard with a sidebar nav, KPI cards at the top, and a data table below"
                rows={4}
                disabled={isGenerating}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none disabled:opacity-60"
              />

              {generateError && (
                <p className="text-sm text-destructive">{generateError}</p>
              )}

              <button
                onClick={handleGenerateDesign}
                disabled={!prompt.trim() || isGenerating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-new-tab-design-generate"
              >
                {isGenerating ? (
                  <><Loader2 size={14} className="animate-spin" />Generating…</>
                ) : (
                  <><Sparkles size={14} />Generate</>
                )}
              </button>

              <p className="text-center text-[11px] text-muted-foreground">⌘ Enter to generate</p>
            </div>

            <button
              onClick={() => { setStep("pick-design-mode"); setGenerateError(null); }}
              className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={isGenerating}
            >
              <ArrowLeft size={12} />
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
