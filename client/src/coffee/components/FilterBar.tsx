import { Link, useLocation } from "wouter";
import { Grid2x2, Globe2, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BREW_LABELS,
  TAG_LABELS,
  type BrewMethod,
  type ShopTag,
} from "@shared/coffee/types";
import type { FacetOption, ShopFilters, SortKey } from "../filters";
import type { UseShopFilters } from "../useShopFilters";
import { PlaceSearch } from "./PlaceSearch";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently visited",
  rating: "Highest rated",
  name: "Name (A–Z)",
  city: "City (A–Z)",
};

const RATING_STEPS = [4.5, 4, 3.5];

/**
 * The atlas control surface, rendered above both the map and the catalogue.
 *
 * Every control writes through `useShopFilters` into the query string, which is
 * what keeps the two views showing the same set of shops and what lets the view
 * switcher hand filters over intact.
 */
export function FilterBar({
  state,
  /** Called when the user picks a place, so the map can fly there. */
  onPlaceSelected,
}: {
  state: UseShopFilters;
  onPlaceSelected?: (bounds: [number, number, number, number]) => void;
}) {
  const { filters, results, total, facets, activeCount, isFiltered } = state;

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <PlaceSearch state={state} onPlaceSelected={onPlaceSelected} />

          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) =>
                state.patchFilters({ query: event.target.value })
              }
              placeholder="Search shops and notes"
              className="h-9 pl-9"
              data-testid="input-coffee-search"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => state.patchFilters({ query: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant={filters.recommendedOnly ? "default" : "outline"}
            size="sm"
            onClick={() =>
              state.patchFilters({ recommendedOnly: !filters.recommendedOnly })
            }
            className="h-9"
            data-testid="button-coffee-recommended"
          >
            <Star
              className={cn("h-4 w-4", filters.recommendedOnly && "fill-current")}
            />
            Recommended
          </Button>

          <MoreFiltersPopover state={state} />

          <Select
            value={filters.sort}
            onValueChange={(value) =>
              state.patchFilters({ sort: value as SortKey })
            }
          >
            <SelectTrigger
              className="h-9 w-[170px]"
              data-testid="select-coffee-sort"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-3">
            <span
              className="coffee-eyebrow whitespace-nowrap text-muted-foreground"
              data-testid="text-coffee-result-count"
            >
              <span className="coffee-display mr-1 text-lg align-[-2px] text-foreground">
                {results.length}
              </span>
              of {total} shops
            </span>
            <ViewSwitcher search={state.search} />
          </div>
        </div>

        {isFiltered && (
          <ActiveFilterChips state={state} activeCount={activeCount} />
        )}
      </div>
    </div>
  );
}

/**
 * Map and catalogue links that carry the current query string across, so
 * switching views never silently drops the filters.
 */
export function ViewSwitcher({ search }: { search: string }) {
  const [pathname] = useLocation();

  const views = [
    { href: "/coffee/map", label: "Map", icon: Globe2 },
    { href: "/coffee/grid", label: "Catalogue", icon: Grid2x2 },
  ];

  return (
    <div className="flex items-center border border-foreground bg-card">
      {views.map((view) => {
        const active = pathname.startsWith(view.href);
        const Icon = view.icon;
        return (
          <Link
            key={view.href}
            href={`${view.href}${search}`}
            replace={false}
            className={cn(
              "coffee-eyebrow flex items-center gap-1.5 px-3 py-2 transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            data-testid={`link-coffee-view-${view.label.toLowerCase()}`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{view.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function MoreFiltersPopover({ state }: { state: UseShopFilters }) {
  const { filters, facets, activeCount } = state;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          data-testid="button-coffee-filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge className="ml-1 h-5 min-w-5 justify-center px-1.5 text-[11px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-[320px] overflow-y-auto p-0"
      >
        <div className="space-y-4 p-4">
          <FacetSection title="Minimum rating">
            <div className="flex flex-wrap gap-1.5">
              {RATING_STEPS.map((step) => (
                <ChipButton
                  key={step}
                  selected={filters.minRating === step}
                  onClick={() =>
                    state.patchFilters({
                      minRating: filters.minRating === step ? 0 : step,
                    })
                  }
                >
                  {step}+
                </ChipButton>
              ))}
            </div>
          </FacetSection>

          <FacetGroup
            title="Country"
            options={facets.countries}
            selected={filters.countries}
            onToggle={(value) => state.toggleValue("countries", value)}
          />
          <FacetGroup
            title="City"
            options={facets.cities}
            selected={filters.cities}
            onToggle={(value) => state.toggleValue("cities", value)}
          />
          <FacetGroup
            title="Vibe"
            options={facets.tags}
            selected={filters.tags}
            label={(value) => TAG_LABELS[value as ShopTag] ?? value}
            onToggle={(value) => state.toggleValue("tags", value as ShopTag)}
          />
          <FacetGroup
            title="Brew method"
            options={facets.brewMethods}
            selected={filters.brewMethods}
            label={(value) => BREW_LABELS[value as BrewMethod] ?? value}
            onToggle={(value) =>
              state.toggleValue("brewMethods", value as BrewMethod)
            }
          />
          <FacetGroup
            title="Price"
            options={facets.priceBands}
            selected={filters.priceBands.map(String)}
            onToggle={(value) => state.toggleValue("priceBands", Number(value))}
          />
          <FacetGroup
            title="Visited in"
            options={facets.years}
            selected={filters.years}
            onToggle={(value) => state.toggleValue("years", value)}
          />
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-popover px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {state.results.length} matching
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={state.clearFilters}
            disabled={activeCount === 0}
          >
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FacetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="coffee-eyebrow mb-2 text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  label = (value) => value,
}: {
  title: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  label?: (value: string) => string;
}) {
  if (options.length === 0) return null;

  return (
    <>
      <Separator />
      <FacetSection title={title}>
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <ChipButton
              key={option.value}
              selected={selected.includes(option.value)}
              onClick={() => onToggle(option.value)}
            >
              {label(option.value)}
              <span className="ml-1 opacity-60">{option.count}</span>
            </ChipButton>
          ))}
        </div>
      </FacetSection>
    </>
  );
}

function ChipButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center border px-2.5 py-1 text-xs transition-colors",
        selected
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card text-foreground hover:border-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Every narrowing filter as a removable chip, so the reason a view is showing
 * three shops instead of twenty-two is always visible.
 */
function ActiveFilterChips({
  state,
  activeCount,
}: {
  state: UseShopFilters;
  activeCount: number;
}) {
  const { filters } = state;

  const chips: { key: string; label: string; remove: () => void }[] = [];

  if (filters.query) {
    chips.push({
      key: "query",
      label: `“${filters.query}”`,
      remove: () => state.patchFilters({ query: "" }),
    });
  }

  const listChip = <K extends keyof ShopFilters>(
    key: K,
    values: string[],
    label: (value: string) => string,
  ) => {
    for (const value of values) {
      chips.push({
        key: `${String(key)}-${value}`,
        label: label(value),
        remove: () =>
          state.toggleValue(
            key,
            // Price bands are numbers in the filter state but strings here.
            (key === "priceBands" ? Number(value) : value) as never,
          ),
      });
    }
  };

  listChip("countries", filters.countries, (value) => value);
  listChip("regions", filters.regions, (value) => value);
  listChip("cities", filters.cities, (value) => value);
  listChip("tags", filters.tags, (value) => TAG_LABELS[value as ShopTag] ?? value);
  listChip(
    "brewMethods",
    filters.brewMethods,
    (value) => BREW_LABELS[value as BrewMethod] ?? value,
  );
  listChip("priceBands", filters.priceBands.map(String), (value) =>
    "$".repeat(Number(value)),
  );
  listChip("years", filters.years, (value) => `Visited ${value}`);

  if (filters.minRating > 0) {
    chips.push({
      key: "rating",
      label: `${filters.minRating}+ stars`,
      remove: () => state.patchFilters({ minRating: 0 }),
    });
  }
  if (filters.recommendedOnly) {
    chips.push({
      key: "recommended",
      label: "Recommended",
      remove: () => state.patchFilters({ recommendedOnly: false }),
    });
  }

  return (
    <div
      className="mt-2.5 flex flex-wrap items-center gap-1.5"
      data-testid="container-coffee-active-filters"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="inline-flex items-center gap-1 border border-brand bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong transition-colors hover:bg-brand hover:text-brand-foreground"
          data-testid={`chip-coffee-filter-${chip.key}`}
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      {activeCount > 1 && (
        <button
          type="button"
          onClick={state.clearFilters}
          className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          data-testid="button-coffee-clear-filters"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
