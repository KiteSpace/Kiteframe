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
  GraduationCap,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  onStartTutorial?: () => void;
  isReadOnly?: boolean;
}

export function Toolbar({
  onOpenAiSettings,
  isDarkMode,
  onToggleDarkMode,
  editorSettings,
  onEditorSettingsChange,
  onOpenBugReport,
  onStartTutorial,
  isReadOnly,
}: ToolbarProps) {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showSettingsDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(target) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(target)
      ) {
        setShowSettingsDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettingsDropdown]);

  return (
    <header
      className="h-16 px-4 py-2 flex items-center justify-between bg-card border-border shadow-sm"
      data-testid="toolbar"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src={kiteframeIcon} alt="Kiteframe" className="w-6 h-6" />
          <h1 className="text-2xl font-semibold">Kiteframe</h1>
          <span
            className="px-2 py-0.5 text-xs font-medium text-white rounded"
            style={{ backgroundColor: "#2b313d" }}
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

        <div className="relative">
          <button
            ref={settingsButtonRef}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            data-testid="button-settings"
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
          >
            <Settings size={16} />
          </button>
          {showSettingsDropdown && (
            <div
              ref={settingsDropdownRef}
              className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-[100] p-3"
            >
              {/* Theme Toggle */}
              {onToggleDarkMode && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDarkMode();
                  }}
                  data-testid="button-theme-toggle"
                >
                  {isDarkMode ? (
                    <Sun size={16} className="text-yellow-500" />
                  ) : (
                    <Moon size={16} className="text-blue-500" />
                  )}
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </button>
              )}

              {/* Bug Report Button */}
              {onOpenBugReport && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBugReport();
                    setShowSettingsDropdown(false);
                  }}
                  data-testid="button-bug-report"
                >
                  <Bug size={16} className="text-red-500" />
                  Report Bug
                </button>
              )}

              {/* Tutorial Button */}
              {onStartTutorial && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartTutorial();
                    setShowSettingsDropdown(false);
                  }}
                  data-testid="button-restart-tutorial"
                >
                  <GraduationCap size={16} className="text-violet-500" />
                  Start Tutorial
                </button>
              )}

              {/* Divider */}
              <div className="border-b border-border my-2"></div>

              {/* Editor Settings Toggles */}
              {editorSettings && onEditorSettingsChange && (
                <div className="space-y-3">
                  {/* Node Auto-Connect Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Label
                        htmlFor="auto-connect-toggle"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Node Auto-Connect
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically connect nodes when moved close
                      </p>
                    </div>
                    <Switch
                      id="auto-connect-toggle"
                      checked={editorSettings.nodeAutoConnect}
                      onCheckedChange={(checked) =>
                        onEditorSettingsChange({
                          ...editorSettings,
                          nodeAutoConnect: checked,
                        })
                      }
                      data-testid="toggle-auto-connect"
                    />
                  </div>

                  {/* Snap to Guides Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Label
                        htmlFor="snap-guides-toggle"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Snap to Guides
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Snap objects for precise alignment
                      </p>
                    </div>
                    <Switch
                      id="snap-guides-toggle"
                      checked={editorSettings.snapToGuides}
                      onCheckedChange={(checked) =>
                        onEditorSettingsChange({
                          ...editorSettings,
                          snapToGuides: checked,
                        })
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
