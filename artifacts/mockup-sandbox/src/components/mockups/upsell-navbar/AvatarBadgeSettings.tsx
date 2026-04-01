import { useState } from "react";
import {
  ChevronDown, Settings, HelpCircle, LogOut,
  Coins, Zap, Sparkles, Sun, Moon, Bug, TrendingUp
} from "lucide-react";

const user = {
  name: "Alex Chen",
  email: "alex@company.io",
};

const credits = 5;
const maxCredits = 25;
const creditsPercent = Math.round((credits / maxCredits) * 100);
const isLow = credits <= 8;

function TierRingAvatar() {
  return (
    <div className="relative">
      <div
        className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-semibold"
        style={{
          boxShadow: "0 0 0 2px hsl(var(--background)), 0 0 0 3.5px hsl(var(--muted-foreground) / 0.4)"
        }}
      >
        AC
      </div>
    </div>
  );
}

export function AvatarBadgeSettings() {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const toggleSettings = () => {
    setSettingsOpen(!settingsOpen);
    setAvatarOpen(false);
  };
  const toggleAvatar = () => {
    setAvatarOpen(!avatarOpen);
    setSettingsOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 px-4 flex items-center bg-card border-b border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground truncate">My Project</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={toggleAvatar}
              className="flex items-center space-x-1 p-1.5 rounded-full hover:bg-accent transition-colors"
            >
              <TierRingAvatar />
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-popover border rounded-md shadow-md z-50">
                <div className="py-1">
                  <div className="px-3 py-2 text-sm border-b">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate">{user.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">Free</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2">
                    <Settings size={16} className="text-muted-foreground" />
                    <span>Account Settings</span>
                  </button>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2">
                    <HelpCircle size={16} className="text-muted-foreground" />
                    <span>FAQ</span>
                  </button>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2">
                    <LogOut size={16} className="text-muted-foreground" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={toggleSettings}
              className={`p-2 rounded-md transition-colors relative ${settingsOpen ? "bg-accent" : "hover:bg-accent"}`}
            >
              <Settings size={16} className="text-foreground" />
              {isLow && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500 ring-1 ring-background" />
              )}
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-[100] p-3">
                <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-lg">
                  <Moon size={16} className="text-blue-500" />
                  Dark Mode
                </button>
                <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-lg">
                  <Bug size={16} className="text-red-500" />
                  Report Bug
                </button>

                <div className="border-b border-border my-2" />

                <div className="px-3 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Coins size={14} className="text-amber-500" />
                      <span>AI Credits</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{creditsPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${isLow ? "bg-orange-500" : "bg-primary"}`}
                      style={{ width: `${creditsPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{credits} of {maxCredits} remaining</p>
                </div>

                <div className="border-b border-border my-2" />

                <div className="px-2 pb-1">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 text-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} />
                        <span className="text-xs font-semibold">Advanced plan</span>
                      </div>
                      <span className="text-[10px] opacity-80 bg-white/20 rounded px-1.5 py-0.5">50 credits/day</span>
                    </div>
                    <p className="text-[11px] opacity-80 mb-2 leading-tight">Unlock 2× credits, workflow reasoning & PRD generation.</p>
                    <button className="w-full py-1.5 rounded-md bg-white text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1">
                      <TrendingUp size={11} />
                      Upgrade plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 pt-80 max-w-xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Option C — Avatar Badge + Settings Card</p>
        <p className="text-sm text-foreground leading-relaxed">
          The toolbar stays minimal. The avatar gets a subtle tier <strong>ring</strong> (grey = Free, blue = Advanced, amber = Pro).
          The <strong>⚙ settings dropdown</strong> gains a contextual upgrade card at the bottom — more details in context, less noise in the nav.
          A small <strong>orange dot</strong> on the gear signals low credits without adding elements.
        </p>
      </div>
    </div>
  );
}
