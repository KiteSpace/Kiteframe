import {
  Plus,
  Sparkles,
  Bot,
  Settings,
  Workflow,
  ChevronDown,
  Sun,
  Moon,
  Bug,
} from "lucide-react";
import { useState } from "react";
import kiteframeIcon from "@assets/kiteframe@2x_1758226635607.png";
import { AuthButton } from "./AuthButton";
import { CreditsWidget } from "./CreditsWidget";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface EditorSettings {
  nodeAutoConnect: boolean;
  snapToGuides: boolean;
}

interface ToolbarProps {
  onOpenAiSettings: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  editorSettings?: EditorSettings;
  onEditorSettingsChange?: (settings: EditorSettings) => void;
  onOpenBugReport?: () => void;
}

export function Toolbar({ 
  onOpenAiSettings, 
  isDarkMode, 
  onToggleDarkMode, 
  editorSettings,
  onEditorSettingsChange,
  onOpenBugReport
}: ToolbarProps) {
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
          <img 
            src={kiteframeIcon} 
            alt="Kiteframe" 
            className="w-6 h-6" 
          />
          <h1 className="text-lg font-semibold">Kiteframe</h1>
          <span 
            className="px-2 py-0.5 text-xs font-medium text-white rounded"
            style={{ backgroundColor: '#64bce3' }}
          >
            Beta
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Authentication */}
        <AuthButton />
        
        {/* AI Credits */}
        <CreditsWidget />
        
        {/* Light/Dark Mode Toggle */}
        {onToggleDarkMode && (
          <button
            className="p-2 rounded-md hover:bg-accent transition-colors"
            onClick={onToggleDarkMode}
            data-testid="button-theme-toggle"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
        
        {/* Bug Report Button */}
        {onOpenBugReport && (
          <button
            className="p-2 rounded-md hover:bg-accent transition-colors"
            onClick={onOpenBugReport}
            data-testid="button-bug-report"
            title="Report Bug or Feature Request"
          >
            <Bug size={16} />
          </button>
        )}
        
        <div className="relative">
          <button
            className="p-2 rounded-md hover:bg-accent transition-colors"
            data-testid="button-settings"
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
          >
            <Settings size={16} />
          </button>
          {showSettingsDropdown && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 p-3">
              {/* AI Settings Button */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-lg mb-3"
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

              {/* Divider */}
              <div className="border-b border-border mb-3"></div>

              {/* Editor Settings Toggles */}
              {editorSettings && onEditorSettingsChange && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Editor Settings</h4>
                  
                  {/* Node Auto-Connect Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Label htmlFor="auto-connect-toggle" className="text-sm font-medium cursor-pointer">
                        Node Auto-Connect
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically connect nodes that are moved close to each other
                      </p>
                    </div>
                    <Switch
                      id="auto-connect-toggle"
                      checked={editorSettings.nodeAutoConnect}
                      onCheckedChange={(checked) => 
                        onEditorSettingsChange({ ...editorSettings, nodeAutoConnect: checked })
                      }
                      data-testid="toggle-auto-connect"
                    />
                  </div>

                  {/* Snap to Guides Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Label htmlFor="snap-guides-toggle" className="text-sm font-medium cursor-pointer">
                        Snap to Guides
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Snap objects to guidelines for precise alignment
                      </p>
                    </div>
                    <Switch
                      id="snap-guides-toggle"
                      checked={editorSettings.snapToGuides}
                      onCheckedChange={(checked) => 
                        onEditorSettingsChange({ ...editorSettings, snapToGuides: checked })
                      }
                      data-testid="toggle-snap-guides"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
