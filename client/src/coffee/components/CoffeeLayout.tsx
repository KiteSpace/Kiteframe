import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Coffee, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import "../coffee-theme.css";

/**
 * Shell for every atlas page.
 *
 * The warm palette is applied by putting `coffee-theme` on <html> for as long
 * as an atlas route is mounted, rather than on a wrapper div, because Radix
 * portals (the command palette, popovers) render into <body> and would
 * otherwise keep the app-wide Graphite tokens.
 */
export function CoffeeLayout({
  children,
  /** Filter bar and view switcher, pinned under the header on map/grid pages. */
  toolbar,
  /** Map needs the full viewport; article pages want normal page scroll. */
  fullBleed = false,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  fullBleed?: boolean;
}) {
  useEffect(() => {
    document.documentElement.classList.add("coffee-theme");
    return () => document.documentElement.classList.remove("coffee-theme");
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        fullBleed ? "h-screen overflow-hidden" : "min-h-screen",
      )}
    >
      <CoffeeHeader />
      {toolbar}
      <main className={cn("flex-1", fullBleed && "min-h-0")}>{children}</main>
      {!fullBleed && <CoffeeFooter />}
    </div>
  );
}

const NAV = [
  { href: "/coffee/map", label: "Map" },
  { href: "/coffee/grid", label: "Catalogue" },
  { href: "/coffee/journal", label: "Journal" },
];

function CoffeeHeader() {
  const [pathname] = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link
          href="/coffee/map"
          className="flex items-center gap-2 font-semibold tracking-tight"
          data-testid="link-coffee-home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Coffee className="h-4 w-4" />
          </span>
          Coffee Atlas
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            // Map and catalogue links keep the current filters; see ViewSwitcher.
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                data-testid={`link-coffee-nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/"
          className="ml-auto hidden text-xs text-muted-foreground hover:text-foreground sm:block"
        >
          Back to Kiteframe
        </Link>
      </div>
    </header>
  );
}

function CoffeeFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          A personal log of coffee shops worth remembering. Entries marked{" "}
          <span className="font-medium text-foreground">sample</span> are seeded
          placeholder content.
        </p>
        <p className="flex items-center gap-1.5">
          <Github className="h-3.5 w-3.5" />
          Photography from Wikimedia Commons under open licences, credited on
          each entry.
        </p>
      </div>
    </footer>
  );
}
