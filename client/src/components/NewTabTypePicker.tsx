import { useEffect } from "react";
import { GitBranch, Layers, X } from "lucide-react";

interface NewTabTypePickerProps {
  onSelectWorkflow: () => void;
  onSelectDesign: () => void;
  onCancel: () => void;
}

export function NewTabTypePicker({
  onSelectWorkflow,
  onSelectDesign,
  onCancel,
}: NewTabTypePickerProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

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
            onClick={onSelectDesign}
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
      </div>
    </div>
  );
}
