import { useEffect, useState } from "react";
import { Building2, Globe, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { filtersForPlace, type Place, type PlaceKind } from "../filters";
import type { UseShopFilters } from "../useShopFilters";

const KIND_ICON: Record<PlaceKind, typeof MapPin> = {
  city: MapPin,
  region: Building2,
  country: Globe,
};

const KIND_HEADING: Record<PlaceKind, string> = {
  city: "Cities",
  region: "Regions",
  country: "Countries",
};

/**
 * Region and city search for the atlas.
 *
 * The index comes from `derivePlaces` — every city, region, and country that
 * actually has a shop in it — so search works offline with no geocoding service
 * and can never offer a place that would return nothing. Picking one both sets
 * the geographic filter (which the catalogue honours too) and hands its bounds
 * to the map so it can fly there.
 */
export function PlaceSearch({
  state,
  onPlaceSelected,
}: {
  state: UseShopFilters;
  onPlaceSelected?: (bounds: [number, number, number, number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const { places, filters } = state;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activePlace =
    filters.cities[0] ?? filters.regions[0] ?? filters.countries[0] ?? null;

  const select = (place: Place) => {
    state.setFilters(filtersForPlace(filters, place));
    onPlaceSelected?.(place.bounds);
    setOpen(false);
  };

  const grouped = (["city", "region", "country"] as PlaceKind[])
    .map((kind) => ({ kind, items: places.filter((place) => place.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 min-w-[190px] justify-start gap-2 font-normal"
          data-testid="button-coffee-place-search"
        >
          <Navigation className="h-4 w-4 text-brand" />
          <span className="truncate">
            {activePlace ?? "Jump to a city or region"}
          </span>
          <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <Command>
          <CommandInput
            placeholder="Search cities, regions, countries"
            data-testid="input-coffee-place-search"
          />
          <CommandList>
            <CommandEmpty>No place in the atlas matches that.</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.kind} heading={KIND_HEADING[group.kind]}>
                {group.items.map((place) => {
                  const Icon = KIND_ICON[place.kind];
                  return (
                    <CommandItem
                      // Context is in the value so "Kanto" finds Tokyo too.
                      key={`${place.kind}-${place.name}-${place.context}`}
                      value={`${place.name} ${place.context}`}
                      onSelect={() => select(place)}
                      className="gap-2"
                      data-testid={`item-coffee-place-${place.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">
                        {place.name}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {place.context}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {place.count}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
