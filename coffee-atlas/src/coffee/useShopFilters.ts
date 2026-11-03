import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { SHOPS } from "@shared/coffee/shops";
import type { CoffeeShop } from "@shared/coffee/types";
import {
  EMPTY_FILTERS,
  SELECTED_SHOP_PARAM,
  applyFilters,
  countActiveFilters,
  deriveFacets,
  derivePlaces,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  type Facets,
  type Place,
  type ShopFilters,
} from "./filters";

/**
 * The atlas-wide filter state, backed by the query string.
 *
 * The map and the catalogue both call this hook, so they always agree on the
 * result set, and navigating between them keeps the filters because the state
 * lives in the URL rather than in component state.
 */
export interface UseShopFilters {
  filters: ShopFilters;
  /** Shops matching the current filters, in the current sort order. */
  results: CoffeeShop[];
  /** Every shop, for "3 of 22" style counts. */
  total: number;
  facets: Facets;
  places: Place[];
  activeCount: number;
  isFiltered: boolean;
  /** Slug of the shop highlighted on the map / in the grid, if any. */
  selectedSlug: string | null;
  setFilters: (next: ShopFilters) => void;
  patchFilters: (patch: Partial<ShopFilters>) => void;
  /** Adds or removes one value from a multi-select facet. */
  toggleValue: <K extends keyof ShopFilters>(
    key: K,
    value: ShopFilters[K] extends Array<infer V> ? V : never,
  ) => void;
  clearFilters: () => void;
  selectShop: (slug: string | null) => void;
  /** Current filters as a query string, for links that must preserve them. */
  search: string;
}

// Facets and places depend only on the dataset, so they are computed once for
// the lifetime of the module rather than on every render.
const ALL_FACETS = deriveFacets(SHOPS);
const ALL_PLACES = derivePlaces(SHOPS);

export function useShopFilters(): UseShopFilters {
  const rawSearch = useSearch();
  const [pathname, navigate] = useLocation();

  const filters = useMemo(() => parseFilters(rawSearch), [rawSearch]);
  const selectedSlug = useMemo(
    () => new URLSearchParams(rawSearch).get(SELECTED_SHOP_PARAM),
    [rawSearch],
  );

  const results = useMemo(() => applyFilters(SHOPS, filters), [filters]);

  const write = useCallback(
    (next: ShopFilters, slug: string | null | undefined) => {
      // `undefined` keeps the current selection; `null` clears it.
      const selected = slug === undefined ? selectedSlug : slug;
      const search = serializeFilters(next, {
        [SELECTED_SHOP_PARAM]: selected ?? undefined,
      });
      // replace, so filter fiddling does not fill the back button with history.
      navigate(`${pathname}${search}`, { replace: true });
    },
    [navigate, pathname, selectedSlug],
  );

  const setFilters = useCallback(
    (next: ShopFilters) => write(next, undefined),
    [write],
  );

  const patchFilters = useCallback(
    (patch: Partial<ShopFilters>) => write({ ...filters, ...patch }, undefined),
    [filters, write],
  );

  const toggleValue = useCallback(
    <K extends keyof ShopFilters>(
      key: K,
      value: ShopFilters[K] extends Array<infer V> ? V : never,
    ) => {
      const current = filters[key];
      if (!Array.isArray(current)) return;
      const list = current as unknown[];
      const next = list.includes(value)
        ? list.filter((entry) => entry !== value)
        : [...list, value];
      write({ ...filters, [key]: next } as ShopFilters, undefined);
    },
    [filters, write],
  );

  const clearFilters = useCallback(
    () => write({ ...EMPTY_FILTERS, sort: filters.sort }, undefined),
    [filters.sort, write],
  );

  const selectShop = useCallback(
    (slug: string | null) => write(filters, slug),
    [filters, write],
  );

  return {
    filters,
    results,
    total: SHOPS.length,
    facets: ALL_FACETS,
    places: ALL_PLACES,
    activeCount: countActiveFilters(filters),
    isFiltered: hasActiveFilters(filters),
    selectedSlug,
    setFilters,
    patchFilters,
    toggleValue,
    clearFilters,
    selectShop,
    search: serializeFilters(filters, {
      [SELECTED_SHOP_PARAM]: selectedSlug ?? undefined,
    }),
  };
}
