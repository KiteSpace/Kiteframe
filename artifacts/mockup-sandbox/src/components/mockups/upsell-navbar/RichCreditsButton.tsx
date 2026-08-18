import { useState } from "react";
import {
  User, ChevronDown, Settings, HelpCircle, LogOut,
  Coins, Zap, ArrowUpRight, Sparkles, TrendingUp
} from "lucide-react";

const user = {
  name: "Alex Chen",
  email: "alex@company.io",
};

const credits = 12;
const maxCredits = 25;
const creditsPercent = Math.round((credits / maxCredits) * 100);
const isLow = credits <= 8;

export function RichCreditsButton() {
  const [creditsOpen, setCreditsOpen] = useState(true);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const toggleCredits = () => {
    setCreditsOpen(!creditsOpen);
    setAvatarOpen(false);
  };
  const toggleAvatar = () => {
    setAvatarOpen(!avatarOpen);
    setCreditsOpen(false);
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
              onClick={toggleCredits}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${
                isLow
                  ? "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              <Coins size={11} className={isLow ? "text-orange-500" : "text-amber-500"} />
              <span>
                {credits}/{maxCredits}
                <span className="ml-1 text-muted-foreground font-normal">· Free</span>
              </span>
              <ArrowUpRight size={11} className={isLow ? "text-orange-500" : "text-primary"} />
            </button>

            {creditsOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-popover border rounded-lg shadow-lg z-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Coins size={16} className="text-amber-500" />
                    <span className="text-sm font-semibold text-foreground">AI Credits</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Free plan</span>
                </div>

                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{credits} remaining</span>
                  <span>{maxCredits} daily</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${isLow ? "bg-orange-500" : "bg-primary"}`}
                    style={{ width: `${creditsPercent}%` }}
                  />
                </div>

                {isLow && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-1">
                    <span>⚠</span> Running low — resets daily at midnight.
                  </p>
                )}

                <div className="border-t border-border pt-3">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={13} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Advanced — 50 credits/day</span>
                    </div>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mb-2">Unlock workflow reasoning, PRD generation & more.</p>
                    <button className="w-full py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                      <TrendingUp size={12} />
                      Upgrade plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2 text-primary">
                    <ArrowUpRight size={16} />
                    <span className="font-medium">Upgrade plan</span>
                  </button>
                  <div className="border-t border-border" />
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

          <button className="p-2 rounded-md hover:bg-accent transition-colors">
            <Settings size={16} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      <div className="px-6 pt-52 max-w-xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Option B — Rich Credits Pill</p>
        <p className="text-sm text-foreground leading-relaxed">
          The coin button is upgraded to a wider pill: <strong>5/25 · Free ↗</strong>. 
          Clicking it opens a compact popover with a progress bar and an inline upgrade card. 
          The avatar dropdown also gains a standard <strong>Upgrade plan</strong> row. 
          Low credits trigger an orange pill + warning copy.
        </p>
      </div>
    </div>
  );
}
