import {
  BREW_METHODS,
  SHOP_TAGS,
  latestVisit,
  visitYears,
  type BrewMethod,
  type CoffeeShop,
  type ShopTag,
} from "@shared/coffee/types";

/**
 * The single source of truth for "which shops am I looking at".
 *
 * The map and the catalogue both render whatever `applyFilters` returns, so
 * they cannot drift apart. State lives in the query string rather than in a
 * provider, which means switching views preserves the filters and any filtered
 * view is a shareable link.
 */

export type SortKey = "recent" | "rating" | "name" | "city";

export interface ShopFilters {
  /** Free text over name, city, neighborhood, country, and notes. */
  query: string;
  countries: string[];
  regions: string[];
  cities: string[];
  tags: ShopTag[];
  brewMethods: BrewMethod[];
  priceBands: number[];
  years: string[];
  /** Minimum star rating, 0 means no minimum. */
  minRating: number;
  recommendedOnly: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: ShopFilters = {
  query: "",
  countries: [],
  regions: [],
  cities: [],
  tags: [],
  brewMethods: [],
  priceBands: [],
  years: [],
  minRating: 0,
  recommendedOnly: false,
  sort: "recent",
};

const SORT_KEYS: SortKey[] = ["recent", "rating", "name", "city"];

/** Query string keys, kept short so shared links stay readable. */
const PARAM = {
  query: "q",
  countries: "country",
  regions: "region",
  cities: "city",
  tags: "tag",
  brewMethods: "brew",
  priceBands: "price",
  years: "year",
  minRating: "rating",
  recommendedOnly: "rec",
  sort: "sort",
} as const;

/** Selection of a single shop, shared between the map popup and the grid. */
export const SELECTED_SHOP_PARAM = "shop";

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Reads filters out of a query string. Unknown or malformed values are dropped
 * rather than rejected, so a hand-edited URL degrades to a broader result set
 * instead of an error page.
 */
export function parseFilters(search: string): ShopFilters {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );

  const allowedTags = new Set<string>(SHOP_TAGS);
  const allowedBrews = new Set<string>(BREW_METHODS);
  const rawSort = params.get(PARAM.sort) as SortKey | null;
  const rating = Number.parseFloat(params.get(PARAM.minRating) ?? "");

  return {
    query: params.get(PARAM.query)?.trim() ?? "",
    countries: splitList(params.get(PARAM.countries)),
    regions: splitList(params.get(PARAM.regions)),
    cities: splitList(params.get(PARAM.cities)),
    tags: splitList(params.get(PARAM.tags)).filter((tag) =>
      allowedTags.has(tag),
    ) as ShopTag[],
    brewMethods: splitList(params.get(PARAM.brewMethods)).filter((brew) =>
      allowedBrews.has(brew),
    ) as BrewMethod[],
    priceBands: splitList(params.get(PARAM.priceBands))
      .map((band) => Number.parseInt(band, 10))
      .filter((band) => band >= 1 && band <= 3),
    years: splitList(params.get(PARAM.years)).filter((year) =>
      /^\d{4}$/.test(year),
    ),
    minRating:
      Number.isFinite(rating) && rating > 0 ? Math.min(rating, 5) : 0,
    recommendedOnly: params.get(PARAM.recommendedOnly) === "1",
    sort: rawSort && SORT_KEYS.includes(rawSort) ? rawSort : "recent",
  };
}

/**
 * Serializes filters back to a query string, omitting defaults so an unfiltered
 * view has a clean URL. `extra` carries non-filter params (the selected shop)
 * through a filter change.
 */
export function serializeFilters(
  filters: ShopFilters,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();

  if (filters.query) params.set(PARAM.query, filters.query);
  if (filters.countries.length) params.set(PARAM.countries, filters.countries.join(","));
  if (filters.regions.length) params.set(PARAM.regions, filters.regions.join(","));
  if (filters.cities.length) params.set(PARAM.cities, filters.cities.join(","));
  if (filters.tags.length) params.set(PARAM.tags, filters.tags.join(","));
  if (filters.brewMethods.length) params.set(PARAM.brewMethods, filters.brewMethods.join(","));
  if (filters.priceBands.length) params.set(PARAM.priceBands, filters.priceBands.join(","));
  if (filters.years.length) params.set(PARAM.years, filters.years.join(","));
  if (filters.minRating > 0) params.set(PARAM.minRating, String(filters.minRating));
  if (filters.recommendedOnly) params.set(PARAM.recommendedOnly, "1");
  if (filters.sort !== EMPTY_FILTERS.sort) params.set(PARAM.sort, filters.sort);

  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/** Whether anything is narrowing the result set (sort order does not count). */
export function hasActiveFilters(filters: ShopFilters): boolean {
  return (
    filters.query !== "" ||
    filters.countries.length > 0 ||
    filters.regions.length > 0 ||
    filters.cities.length > 0 ||
    filters.tags.length > 0 ||
    filters.brewMethods.length > 0 ||
    filters.priceBands.length > 0 ||
    filters.years.length > 0 ||
    filters.minRating > 0 ||
    filters.recommendedOnly
  );
}

export function countActiveFilters(filters: ShopFilters): number {
  return (
    (filters.query ? 1 : 0) +
    filters.countries.length +
    filters.regions.length +
    filters.cities.length +
    filters.tags.length +
    filters.brewMethods.length +
    filters.priceBands.length +
    filters.years.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.recommendedOnly ? 1 : 0)
  );
}

function matchesQuery(shop: CoffeeShop, query: string): boolean {
  const haystack = [
    shop.name,
    shop.neighborhood ?? "",
    shop.city,
    shop.region,
    shop.country,
    shop.summary,
    shop.orderThis,
    shop.review,
  ]
    .join(" ")
    .toLowerCase();

  // Every whitespace-separated term must appear somewhere, so "tokyo filter"
  // narrows rather than widens.
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

const SORTERS: Record<SortKey, (a: CoffeeShop, b: CoffeeShop) => number> = {
  recent: (a, b) => latestVisit(b).localeCompare(latestVisit(a)),
  rating: (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  city: (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name),
};

/**
 * AND across categories, OR within one: selecting two cities widens to either
 * city, but adding a tag narrows to shops in those cities that also carry it.
 */
export function applyFilters(
  shops: CoffeeShop[],
  filters: ShopFilters,
): CoffeeShop[] {
  const matched = shops.filter((shop) => {
    if (filters.query && !matchesQuery(shop, filters.query)) return false;
    if (filters.countries.length && !filters.countries.includes(shop.country)) return false;
    if (filters.regions.length && !filters.regions.includes(shop.region)) return false;
    if (filters.cities.length && !filters.cities.includes(shop.city)) return false;
    if (filters.priceBands.length && !filters.priceBands.includes(shop.priceBand)) return false;
    if (filters.minRating > 0 && shop.rating < filters.minRating) return false;
    if (filters.recommendedOnly && !shop.recommended) return false;

    if (
      filters.tags.length &&
      !filters.tags.some((tag) => shop.tags.includes(tag))
    ) {
      return false;
    }
    if (
      filters.brewMethods.length &&
      !filters.brewMethods.some((brew) => shop.brewMethods.includes(brew))
    ) {
      return false;
    }
    if (filters.years.length) {
      const years = visitYears(shop);
      if (!filters.years.some((year) => years.includes(year))) return false;
    }

    return true;
  });

  return matched.sort(SORTERS[filters.sort]);
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facets {
  countries: FacetOption[];
  regions: FacetOption[];
  cities: FacetOption[];
  tags: FacetOption[];
  brewMethods: FacetOption[];
  priceBands: FacetOption[];
  years: FacetOption[];
}

function tally(
  shops: CoffeeShop[],
  pick: (shop: CoffeeShop) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shop of shops) {
    for (const value of pick(shop)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function toOptions(
  counts: Map<string, number>,
  label: (value: string) => string = (value) => value,
  compare: (a: FacetOption, b: FacetOption) => number = (a, b) =>
    b.count - a.count || a.label.localeCompare(b.label),
): FacetOption[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort(compare);
}

/**
 * Builds the filter options from the data itself, so adding a shop in a new
 * country makes that country filterable without touching any UI code.
 */
export function deriveFacets(shops: CoffeeShop[]): Facets {
  return {
    countries: toOptions(tally(shops, (shop) => [shop.country])),
    regions: toOptions(tally(shops, (shop) => [shop.region])),
    cities: toOptions(tally(shops, (shop) => [shop.city])),
    tags: toOptions(tally(shops, (shop) => shop.tags)),
    brewMethods: toOptions(tally(shops, (shop) => shop.brewMethods)),
    priceBands: toOptions(
      tally(shops, (shop) => [String(shop.priceBand)]),
      (value) => "$".repeat(Number(value)),
      (a, b) => a.value.localeCompare(b.value),
    ),
    years: toOptions(
      tally(shops, visitYears),
      (value) => value,
      (a, b) => b.value.localeCompare(a.value),
    ),
  };
}

export type PlaceKind = "city" | "region" | "country";

export interface Place {
  kind: PlaceKind;
  name: string;
  /** e.g. "Victoria, Australia" — enough to disambiguate same-named cities. */
  context: string;
  count: number;
  /** Centre of the matching shops, for the map to fly to. */
  center: [number, number];
  /** `[west, south, east, north]` around the matching shops. */
  bounds: [number, number, number, number];
}

function placeFrom(
  kind: PlaceKind,
  name: string,
  context: string,
  shops: CoffeeShop[],
): Place {
  const lngs = shops.map((shop) => shop.coords[0]);
  const lats = shops.map((shop) => shop.coords[1]);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const south = Math.min(...lats);
  const north = Math.max(...lats);

  return {
    kind,
    name,
    context,
    count: shops.length,
    center: [(west + east) / 2, (south + north) / 2],
    bounds: [west, south, east, north],
  };
}

/**
 * The searchable place index for the map: every city, region, and country that
 * actually has a shop in it, with the extent needed to zoom there. Derived from
 * the dataset, so there is no geocoding service and no network dependency.
 */
export function derivePlaces(shops: CoffeeShop[]): Place[] {
  const cities = new Map<string, CoffeeShop[]>();
  const regions = new Map<string, CoffeeShop[]>();
  const countries = new Map<string, CoffeeShop[]>();

  for (const shop of shops) {
    const cityKey = `${shop.city}|${shop.region}|${shop.country}`;
    for (const [map, key] of [
      [cities, cityKey],
      [regions, `${shop.region}|${shop.country}`],
      [countries, shop.country],
    ] as const) {
      const bucket = map.get(key);
      if (bucket) bucket.push(shop);
      else map.set(key, [shop]);
    }
  }

  const places: Place[] = [];

  for (const [key, group] of Array.from(cities.entries())) {
    const [city, region, country] = key.split("|");
    places.push(placeFrom("city", city, `${region}, ${country}`, group));
  }
  for (const [key, group] of Array.from(regions.entries())) {
    const [region, country] = key.split("|");
    // A region whose name repeats the city (Berlin, Oslo) adds no information.
    if (group.every((shop) => shop.city === region)) continue;
    places.push(placeFrom("region", region, country, group));
  }
  for (const [country, group] of Array.from(countries.entries())) {
    places.push(placeFrom("country", country, `${group.length} in the atlas`, group));
  }

  const kindOrder: Record<PlaceKind, number> = { city: 0, region: 1, country: 2 };
  return places.sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.name.localeCompare(b.name),
  );
}

/** Applies a place selection as the matching geographic filter. */
export function filtersForPlace(
  filters: ShopFilters,
  place: Place,
): ShopFilters {
  const cleared = { ...filters, cities: [], regions: [], countries: [] };
  if (place.kind === "city") return { ...cleared, cities: [place.name] };
  if (place.kind === "region") return { ...cleared, regions: [place.name] };
  return { ...cleared, countries: [place.name] };
}
