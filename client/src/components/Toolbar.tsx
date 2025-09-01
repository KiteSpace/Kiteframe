import {
  Plus,
  Sparkles,
  Bot,
  Settings,
  Workflow,
  ChevronDown,
  Ship,
  TestTube,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface ToolbarProps {
  onOpenAiSettings: () => void;
  onOpenPluginTest?: () => void;
}

export function Toolbar({ onOpenAiSettings, onOpenPluginTest }: ToolbarProps) {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  return (
    <header
      className="h-14 px-4 py-2 flex items-center justify-between bg-card border-b border-border shadow-sm"
      data-testid="toolbar"
      onClick={(e: React.MouseEvent) => {
        // Close dropdown when clicking outside
        const target = e.target as HTMLElement;
        if (
          target && typeof target.closest === 'function' &&
          !target.closest('[data-testid="button-settings"]') &&
          !target.closest(".absolute")
        ) {
          setShowSettingsDropdown(false);
        }
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Ship className="text-primary" size={24} />
          <h1 className="text-lg font-semibold">Driftline</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
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
              {onOpenPluginTest && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-b-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPluginTest();
                    setShowSettingsDropdown(false);
                  }}
                  data-testid="button-plugin-test"
                >
                  <TestTube size={16} className="text-green-500" />
                  Test Plugins
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
