import { useEffect, useState } from "react";
import { GitBranch, Layers, X, Sparkles, PenTool, ArrowLeft } from "lucide-react";

type Step = "pick-type" | "pick-design-mode";

interface NewTabTypePickerProps {
  onSelectWorkflow: () => void;
  onSelectDesign: () => void;
  onOpenDesignById: (designId: string) => void;
  onCancel: () => void;
}

export function NewTabTypePicker({
  onSelectWorkflow,
  onSelectDesign,
  onOpenDesignById,
  onCancel,
}: NewTabTypePickerProps) {
  const [step, setStep] = useState<Step>("pick-type");
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step === "pick-design-mode") setStep("pick-type");
        else onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, step]);

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
        const { id } = await resp.json();
        onOpenDesignById(id);
      } else {
        console.error("[NewTabTypePicker] Failed to create blank design, status:", resp.status);
        setIsCreatingBlank(false);
      }
    } catch (err) {
      console.error("[NewTabTypePicker] Failed to create blank design:", err);
      setIsCreatingBlank(false);
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
        ) : (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground">How would you like to start?</h2>
              <p className="text-muted-foreground mt-2 text-sm">Generate from a description or start with a blank canvas</p>
            </div>

            <div className="flex gap-6">
              <button
                onClick={onSelectDesign}
                className="group flex flex-col items-center gap-4 w-48 p-8 rounded-2xl border-2 border-border bg-card hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer text-left"
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
                className="group flex flex-col items-center gap-4 w-48 p-8 rounded-2xl border-2 border-border bg-card hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer text-left disabled:opacity-60 disabled:cursor-not-allowed"
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
            </div>

            <button
              onClick={() => setStep("pick-type")}
              className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={12} />
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
