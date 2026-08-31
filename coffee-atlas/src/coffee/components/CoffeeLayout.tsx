import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import "../coffee-theme.css";

/**
 * Shell for every atlas page.
 *
 * `coffee-theme` lives on <html> (set in index.html, reinforced here) rather
 * than a wrapper div, because Radix portals render into <body> and need the
 * same tokens as the rest of the page.
 */
export function CoffeeLayout({
  children,
  /**
   * Black title band. Rendered directly under the header so the two read as a
   * single band, with the toolbar below them rather than sandwiched between.
   */
  hero,
  /** Filter bar and view switcher, pinned under the header on map/grid pages. */
  toolbar,
  /** Map needs the full viewport; article pages want normal page scroll. */
  fullBleed = false,
}: {
  children: ReactNode;
  hero?: ReactNode;
  toolbar?: ReactNode;
  fullBleed?: boolean;
}) {
  useEffect(() => {
    document.documentElement.classList.add("coffee-theme");
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        fullBleed ? "h-screen overflow-hidden" : "min-h-screen",
      )}
    >
      <CoffeeHeader />
      {hero}
      {toolbar}
      <main className={cn("flex-1", fullBleed && "min-h-0")}>{children}</main>
      {!fullBleed && <CoffeeFooter />}
    </div>
  );
}

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/grid", label: "Catalogue" },
  { href: "/journal", label: "Journal" },
];

function CoffeeHeader() {
  const [pathname] = useLocation();

  return (
    <header className="coffee-band sticky top-0 z-30">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-8 px-4 sm:px-6">
        <Link
          href="/map"
          className="coffee-display text-2xl leading-none sm:text-[28px]"
          data-testid="link-coffee-home"
        >
          Coffee Atlas
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "coffee-eyebrow px-3 py-2 transition-colors",
                  active
                    ? "text-brand"
                    : "coffee-band-muted hover:text-[var(--band-foreground)]",
                )}
                data-testid={`link-coffee-nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/**
 * The oversized black title band that opens the catalogue, journal, and article
 * pages. `title` is set in the display face and is meant to run large — short
 * words fill the width, longer ones wrap into two or three stacked lines.
 */
export function CoffeeHero({
  eyebrow,
  title,
  lead,
  meta,
  size = "lg",
  width = "wide",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** A sentence or two under the title. */
  lead?: ReactNode;
  /** Dates, ratings, tags — sits below the lead on a divider. */
  meta?: ReactNode;
  /** `lg` for section landings, `md` for individual articles. */
  size?: "lg" | "md";
  /**
   * Match the width of whatever follows, so the title's left edge lines up
   * with the body beneath it. `article` for a centred prose column.
   */
  width?: "wide" | "article";
}) {
  return (
    <div className="coffee-band">
      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          width === "article" ? "max-w-3xl" : "max-w-[1400px]",
          size === "lg" ? "py-12 sm:py-16" : "py-10 sm:py-12",
        )}
      >
        {eyebrow && (
          <p className="coffee-eyebrow coffee-band-muted mb-4">{eyebrow}</p>
        )}

        <h1
          className={cn(
            "coffee-display coffee-display-tight max-w-[16ch] text-balance",
            size === "lg"
              ? "text-[15vw] sm:text-[9vw] lg:text-[7.5rem]"
              : "text-[11vw] sm:text-[6vw] lg:text-[4.5rem]",
          )}
          data-testid="text-coffee-hero-title"
        >
          {title}
        </h1>

        {lead && (
          <p className="coffee-band-muted mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
            {lead}
          </p>
        )}

        {meta && (
          <div className="coffee-band-divider mt-8 border-t pt-4">{meta}</div>
        )}
      </div>
    </div>
  );
}

function CoffeeFooter() {
  return (
    <footer className="coffee-band mt-16">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
        <p className="coffee-display max-w-[14ch] text-4xl sm:text-5xl">
          Drink better coffee
        </p>
        <div className="coffee-band-divider mt-8 grid gap-6 border-t pt-6 text-xs sm:grid-cols-2">
          <p className="coffee-band-muted max-w-md leading-relaxed">
            A personal log of coffee shops worth remembering. Entries marked{" "}
            <span className="text-[var(--band-foreground)]">sample</span> are
            seeded placeholder content, not first-hand reviews.
          </p>
          <p className="coffee-band-muted max-w-md leading-relaxed sm:text-right">
            Photography from Wikimedia Commons under open licences, credited on
            each entry. Basemap from OpenFreeMap and OpenStreetMap.
          </p>
        </div>
      </div>
    </footer>
  );
}
