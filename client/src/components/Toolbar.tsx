interface ToolbarProps {
  onNewWorkflow: () => void;
  onOpenWorkflow: () => void;
  onSaveWorkflow: () => void;
  onOpenAiSettings: () => void;
  zoom: number;
}

export function Toolbar({
  onNewWorkflow,
  onOpenWorkflow,
  onSaveWorkflow,
  onOpenAiSettings,
  zoom
}: ToolbarProps) {
  return (
    <header className="h-14 px-4 flex items-center justify-between bg-card border-b border-border shadow-sm" data-testid="toolbar">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <i className="fas fa-project-diagram text-primary text-xl" />
          <h1 className="text-lg font-semibold">KiteFrame</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            onClick={onNewWorkflow}
            data-testid="button-new-workflow"
          >
            <i className="fas fa-plus mr-1" />
            New Workflow
          </button>
          <button
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            onClick={onOpenWorkflow}
            data-testid="button-open-workflow"
          >
            <i className="fas fa-folder-open mr-1" />
            Open
          </button>
          <button
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            onClick={onSaveWorkflow}
            data-testid="button-save-workflow"
          >
            <i className="fas fa-save mr-1" />
            Save
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground" data-testid="text-zoom-level">
          Zoom: {Math.round(zoom * 100)}%
        </div>
        <button
          className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
          onClick={onOpenAiSettings}
          data-testid="button-ai-settings"
        >
          <i className="fas fa-robot mr-1" />
          AI Settings
        </button>
        <button className="p-2 rounded-md hover:bg-accent transition-colors" data-testid="button-settings">
          <i className="fas fa-cog" />
        </button>
      </div>
    </header>
  );
}
