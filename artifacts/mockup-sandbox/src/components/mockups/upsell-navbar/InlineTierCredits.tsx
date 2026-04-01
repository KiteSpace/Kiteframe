import { useState } from "react";
import {
  User, ChevronDown, Settings, HelpCircle, LogOut,
  Coins, Zap, ArrowUpRight, Sparkles, Crown, Shield,
  Moon, Bug
} from "lucide-react";

const user = {
  name: "Alex Chen",
  email: "alex@company.io",
  avatarUrl: null as string | null,
};

const tier = "free";
const credits = 5;
const maxCredits = 25;
const creditsPercent = Math.round((credits / maxCredits) * 100);

function TierPill() {
  if (tier === "pro") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white">
      <Crown size={10} /> Pro
    </span>
  );
  if (tier === "advanced") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
      <Sparkles size={10} /> Advanced
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      Free plan
    </span>
  );
}

function CreditsBadge() {
  const isLow = credits <= 8;
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
      isLow
        ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800"
        : "bg-muted text-muted-foreground border-border"
    }`}>
      <Coins size={10} className={isLow ? "text-orange-500" : "text-amber-500"} />
      {credits} credits
    </div>
  );
}

export function InlineTierCredits() {
  const [avatarOpen, setAvatarOpen] = useState(true);

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
          <TierPill />
          <CreditsBadge />

          <div className="relative">
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="flex items-center space-x-1 p-1.5 rounded-full hover:bg-accent transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-semibold">
                AC
              </div>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-popover border rounded-md shadow-md z-50">
                <div className="py-1">
                  <div className="px-3 py-2 text-sm border-b">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate">{user.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">Free</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>

                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between rounded-sm mx-1 pr-3" style={{width: "calc(100% - 8px)"}}>
                    <div className="flex items-center gap-2">
                      <ArrowUpRight size={15} className="text-primary" />
                      <span className="font-medium text-primary">Upgrade plan</span>
                    </div>
                    <span className="text-xs text-muted-foreground">50 credits/day</span>
                  </button>

                  <div className="border-t border-border my-1" />

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

      <div className="px-6 pt-64 max-w-xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Option A — Inline Tier + Credits</p>
        <p className="text-sm text-foreground leading-relaxed">
          Plan tier pill and credit count are always visible in the toolbar — no clicks needed. 
          The avatar dropdown gains a highlighted <strong>Upgrade plan</strong> row (Claude-style) with a credit allowance hint.
          Low credits turn the badge orange as an urgency signal.
        </p>
      </div>
    </div>
  );
}
