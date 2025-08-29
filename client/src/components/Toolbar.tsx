import { Plus, Sparkles, Bot, Settings, Workflow, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ToolbarProps {
  onNewWorkflow: () => void;
  onOpenAiSettings: () => void;
  onOpenAiGenerator: () => void;
}

export function Toolbar({
  onNewWorkflow,
  onOpenAiSettings,
  onOpenAiGenerator
}: ToolbarProps) {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  return (
    <header 
      className="h-14 px-4 flex items-center justify-between bg-card border-b border-border shadow-sm" 
      data-testid="toolbar"
      onClick={(e: React.MouseEvent) => {
        // Close dropdown when clicking outside
        const target = e.target as HTMLElement;
        if (!target.closest('[data-testid="button-settings"]') && !target.closest('.absolute')) {
          setShowSettingsDropdown(false);
        }
      }}
    >
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
        <div className="relative">
          <button 
            className="p-2 rounded-md hover:bg-accent transition-colors" 
            data-testid="button-settings"
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
          >
            <Settings size={16} />
          </button>
          {showSettingsDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-t-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAiSettings();
                  setShowSettingsDropdown(false);
                }}
                data-testid="button-ai-settings"
              >
                <Bot size={16} className="text-purple-500" />
                AI Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
