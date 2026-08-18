import { useState } from "react";
import {
  ChevronDown, Settings, HelpCircle, LogOut,
  Coins, Zap, Sparkles, TrendingUp
} from "lucide-react";

const user = {
  name: "Alex Chen",
  email: "alex@company.io",
};

const credits = 5;
const maxCredits = 25;
const creditsPercent = Math.round((credits / maxCredits) * 100);
const isLow = credits <= 8;
const tierLabel = "Free";

export function CombinedCreditsTier() {
  const [pillOpen, setPillOpen] = useState(true);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const togglePill = () => {
    setPillOpen(!pillOpen);
    setAvatarOpen(false);
  };
  const toggleAvatar = () => {
    setAvatarOpen(!avatarOpen);
    setPillOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 px-4 flex items-center bg-card border-b border-border">
        {/* Left: logo + project name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground truncate">My Project</span>
        </div>

        {/* Right: credits pill + avatar + settings */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Credits + tier pill */}
          <div className="relative">
            <button
              onClick={togglePill}
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${
                isLow
                  ? "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800"
                  : "bg-muted text-foreground border-border hover:bg-accent"
              }`}
            >
              <Coins
                size={12}
                className={isLow ? "text-orange-500" : "text-amber-500"}
              />
              <span>{credits}</span>
              <span className="text-muted-foreground font-normal">·</span>
              <span className={isLow ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}>
                {tierLabel}
              </span>

              {/* Orange alert dot — low credits only */}
              {isLow && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 ring-1 ring-background" />
              )}
            </button>

            {/* Dropdown */}
            {pillOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">

                {/* Credits section */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Coins size={14} className="text-amber-500" />
                      <span className="text-sm font-semibold text-foreground">AI Credits</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {credits} / {maxCredits} today
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLow ? "bg-orange-500" : "bg-primary"
                      }`}
                      style={{ width: `${creditsPercent}%` }}
                    />
                  </div>

                  {isLow && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5 leading-tight">
                      Running low — resets daily at midnight.
                    </p>
                  )}
                </div>

                <div className="border-t border-border" />

                {/* Upgrade card */}
                <div className="p-3">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 text-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} />
                        <span className="text-xs font-semibold">Advanced plan</span>
                      </div>
                      <span className="text-[10px] opacity-80 bg-white/20 rounded px-1.5 py-0.5">
                        50 credits/day
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mb-2.5 leading-snug">
                      Unlock 2× credits, workflow reasoning &amp; PRD generation.
                    </p>
                    <button className="w-full py-1.5 rounded-md bg-white/20 hover:bg-white/30 border border-white/40 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                      <TrendingUp size={11} />
                      Upgrade plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Avatar button (unchanged from current app) */}
          <div className="relative">
            <button
              onClick={toggleAvatar}
              className="flex items-center space-x-1 p-1.5 rounded-full hover:bg-accent transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-semibold">
                AC
              </div>
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

          {/* Settings gear (unchanged) */}
          <button className="p-2 rounded-md hover:bg-accent transition-colors">
            <Settings size={16} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Description */}
      <div className="px-6 pt-72 max-w-xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Combined — B+C Hybrid
        </p>
        <p className="text-sm text-foreground leading-relaxed">
          Toolbar pill shows <strong>🪙 5 · Free</strong> with an <strong>orange alert dot</strong> when credits are low.
          Clicking opens a compact dropdown: a <strong>credit progress bar</strong> (orange when low) on top,
          then the <strong>Advanced plan upgrade card</strong> below. Avatar and settings gear are unchanged.
        </p>
      </div>
    </div>
  );
}
