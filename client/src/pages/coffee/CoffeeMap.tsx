import { useCallback, useEffect, useRef } from "react";
import { Globe2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoffeeLayout } from "@/coffee/components/CoffeeLayout";
import { FilterBar } from "@/coffee/components/FilterBar";
import { MapPopupCard } from "@/coffee/components/MapPopupCard";
import { GlobeMap, type GlobeMapHandle } from "@/coffee/map/GlobeMap";
import { useShopFilters } from "@/coffee/useShopFilters";
import type { CoffeeShop } from "@shared/coffee/types";

/**
 * Map view: a clustered globe over the filtered shops.
 *
 * Reads the same `useShopFilters` state as the catalogue, so the two views can
 * never disagree about which shops are in scope.
 */
export default function CoffeeMapPage() {
  const state = useShopFilters();
  const mapRef = useRef<GlobeMapHandle>(null);

  const { results, selectedSlug, selectShop, search, filters } = state;

  const onPlaceSelected = useCallback((bounds: [number, number, number, number]) => {
    mapRef.current?.flyToBounds(bounds);
  }, []);

  // A geographic filter arriving from a shared link should frame that place,
  // not leave the viewer looking at the whole globe.
  const framedRef = useRef(false);
  useEffect(() => {
    if (framedRef.current || results.length === 0) return;
    const geographic =
      filters.cities.length > 0 ||
      filters.regions.length > 0 ||
      filters.countries.length > 0;
    if (!geographic) return;

    framedRef.current = true;
    const lngs = results.map((shop) => shop.coords[0]);
    const lats = results.map((shop) => shop.coords[1]);
    mapRef.current?.flyToBounds([
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats),
    ]);
  }, [filters.cities, filters.countries, filters.regions, results]);

  const renderPopup = useCallback(
    (shop: CoffeeShop) => <MapPopupCard shop={shop} search={search} />,
    [search],
  );

  return (
    <CoffeeLayout
      fullBleed
      toolbar={<FilterBar state={state} onPlaceSelected={onPlaceSelected} />}
    >
      <div className="relative h-full w-full">
        <GlobeMap
          ref={mapRef}
          shops={results}
          selectedSlug={selectedSlug}
          onSelect={selectShop}
          renderPopup={renderPopup}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 sm:justify-start sm:p-5">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
            <Layers className="h-3.5 w-3.5 text-brand" />
            <span className="text-muted-foreground">
              Numbered circles group nearby shops — click one to zoom in.
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => mapRef.current?.resetView()}
              data-testid="button-coffee-reset-view"
            >
              <Globe2 className="h-3.5 w-3.5" />
              Whole globe
            </Button>
          </div>
        </div>

        {results.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-xs rounded-lg border border-border bg-background/95 p-5 text-center shadow-xl backdrop-blur">
              <p className="font-medium">No shops match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Loosen a filter to bring pins back to the map.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={state.clearFilters}
                data-testid="button-coffee-map-clear"
              >
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </CoffeeLayout>
  );
}
