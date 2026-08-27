import { Button } from "@/components/ui/button";
import { CoffeeHero, CoffeeLayout } from "@/coffee/components/CoffeeLayout";
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
  const { results, total, selectedSlug, search, isFiltered } = state;

  const countries = new Set(results.map((shop) => shop.country)).size;
  const cities = new Set(results.map((shop) => shop.city)).size;

  return (
    <CoffeeLayout
      hero={
        <CoffeeHero
          eyebrow="Every shop in the atlas"
          title="The catalogue"
          lead="Everywhere worth writing down, with what to order when you get there."
          meta={
            <dl className="flex flex-wrap gap-x-10 gap-y-3">
              <HeroStat label="Shops" value={`${results.length} / ${total}`} />
              <HeroStat label="Cities" value={cities} />
              <HeroStat label="Countries" value={countries} />
            </dl>
          }
        />
      }
      toolbar={<FilterBar state={state} />}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
        {results.length === 0 ? (
          <div className="mx-auto max-w-md border border-dashed border-border py-20 text-center">
            <p className="coffee-display text-3xl">Nothing matches</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              No shops match these filters. Try removing one, or search a
              different city.
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={state.clearFilters}
                data-testid="button-coffee-grid-clear"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="coffee-eyebrow coffee-band-muted">{label}</dt>
      <dd className="coffee-display mt-1 text-3xl tabular-nums">{value}</dd>
    </div>
  );
}
