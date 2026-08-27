import { Button } from "@/components/ui/button";
import { CoffeeLayout } from "@/coffee/components/CoffeeLayout";
import { FilterBar } from "@/coffee/components/FilterBar";
import { ShopCard } from "@/coffee/components/ShopCard";
import { useShopFilters } from "@/coffee/useShopFilters";

/**
 * Catalogue view: the same filtered result set as the map, as a grid of tiles.
 *
 * Both views call `useShopFilters`, so "3 of 22" here always means the same
 * three shops that have pins on the map.
 */
export default function CoffeeCataloguePage() {
  const state = useShopFilters();
  const { results, selectedSlug, search, isFiltered } = state;

  return (
    <CoffeeLayout toolbar={<FilterBar state={state} />}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {results.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-dashed border-border py-16 text-center">
            <p className="font-medium">No shops match these filters</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Try removing a filter, or search a different city.
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={state.clearFilters}
                data-testid="button-coffee-grid-clear"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="grid-coffee-shops"
          >
            {results.map((shop) => (
              <ShopCard
                key={shop.slug}
                shop={shop}
                search={search}
                highlighted={shop.slug === selectedSlug}
              />
            ))}
          </div>
        )}
      </div>
    </CoffeeLayout>
  );
}
