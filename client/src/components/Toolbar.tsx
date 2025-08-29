import { Plus, Sparkles, Bot, Settings, Workflow } from 'lucide-react';

interface ToolbarProps {
  onNewWorkflow: () => void;
  onOpenAiSettings: () => void;
  onOpenAiGenerator: () => void;
  zoom: number;
}

export function Toolbar({
  onNewWorkflow,
  onOpenAiSettings,
  onOpenAiGenerator,
  zoom
}: ToolbarProps) {
  return (
    <header className="h-14 px-4 flex items-center justify-between bg-card border-b border-border shadow-sm" data-testid="toolbar">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Workflow className="text-primary" size={24} />
          <h1 className="text-lg font-semibold">KiteFrame</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            onClick={onNewWorkflow}
            data-testid="button-new-workflow"
          >
            <Plus size={16} />
            New Workflow
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 transition-all duration-200 flex items-center gap-1.5"
            onClick={onOpenAiGenerator}
            data-testid="button-ai-generator"
          >
            <Sparkles size={16} />
            AI Generate
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground" data-testid="text-zoom-level">
          Zoom: {Math.round(zoom * 100)}%
        </div>
        <button
          className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
          onClick={onOpenAiSettings}
          data-testid="button-ai-settings"
        >
          <Bot size={16} />
          AI Settings
        </button>
        <button className="p-2 rounded-md hover:bg-accent transition-colors" data-testid="button-settings">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
