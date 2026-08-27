import { describe, expect, it } from "vitest";
import { SHOPS } from "@shared/coffee/shops";
import type { CoffeeShop } from "@shared/coffee/types";
import {
  EMPTY_FILTERS,
  applyFilters,
  countActiveFilters,
  deriveFacets,
  derivePlaces,
  filtersForPlace,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  type ShopFilters,
} from "../filters";

function shop(overrides: Partial<CoffeeShop> = {}): CoffeeShop {
  return {
    slug: "test-shop",
    name: "Test Shop",
    city: "Testville",
    region: "Test Region",
    country: "Testland",
    coords: [0, 0],
    visits: ["2024-01-01"],
    rating: 4,
    priceBand: 2,
    tags: [],
    brewMethods: ["espresso"],
    recommended: false,
    orderThis: "An espresso",
    summary: "A shop for testing.",
    review: "A shop for testing.",
    photos: [],
    sample: true,
    ...overrides,
  };
}

const filters = (overrides: Partial<ShopFilters> = {}): ShopFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe("parseFilters", () => {
  it("returns defaults for an empty search string", () => {
    expect(parseFilters("")).toEqual(EMPTY_FILTERS);
  });

  it("reads every supported parameter", () => {
    const parsed = parseFilters(
      "?q=tokyo&city=Tokyo,Oslo&country=Japan&region=Kanto&tag=quiet&brew=pour-over&price=1,3&year=2024&rating=4.5&rec=1&sort=rating",
    );

    expect(parsed).toEqual({
      query: "tokyo",
      countries: ["Japan"],
      regions: ["Kanto"],
      cities: ["Tokyo", "Oslo"],
      tags: ["quiet"],
      brewMethods: ["pour-over"],
      priceBands: [1, 3],
      years: ["2024"],
      minRating: 4.5,
      recommendedOnly: true,
      sort: "rating",
    });
  });

  it("tolerates a leading search string with no question mark", () => {
    expect(parseFilters("city=Tokyo").cities).toEqual(["Tokyo"]);
  });

  it("drops values that are not part of the content vocabulary", () => {
    const parsed = parseFilters("?tag=quiet,not-a-tag&brew=espresso,telepathy");
    expect(parsed.tags).toEqual(["quiet"]);
    expect(parsed.brewMethods).toEqual(["espresso"]);
  });

  it("ignores out-of-range and unparseable numbers", () => {
    const parsed = parseFilters("?price=0,2,9&rating=banana&sort=sideways");
    expect(parsed.priceBands).toEqual([2]);
    expect(parsed.minRating).toBe(0);
    expect(parsed.sort).toBe("recent");
  });

  it("caps the rating at five", () => {
    expect(parseFilters("?rating=11").minRating).toBe(5);
  });
});

describe("serializeFilters", () => {
  it("omits defaults so an unfiltered view has a clean URL", () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const original = filters({
      query: "pour over",
      cities: ["Tokyo", "Melbourne"],
      countries: ["Japan"],
      regions: ["Kanto"],
      tags: ["quiet", "laptop-friendly"],
      brewMethods: ["pour-over"],
      priceBands: [2, 3],
      years: ["2024", "2023"],
      minRating: 4,
      recommendedOnly: true,
      sort: "city",
    });

    expect(parseFilters(serializeFilters(original))).toEqual(original);
  });

  it("carries extra parameters through and skips empty ones", () => {
    const search = serializeFilters(filters({ minRating: 4 }), {
      shop: "fuglen-tokyo",
      empty: undefined,
    });

    const params = new URLSearchParams(search);
    expect(params.get("shop")).toBe("fuglen-tokyo");
    expect(params.get("rating")).toBe("4");
    expect(params.has("empty")).toBe(false);
  });
});

describe("applyFilters", () => {
  const dataset = [
    shop({
      slug: "quiet-tokyo",
      name: "Quiet Tokyo",
      city: "Tokyo",
      region: "Kanto",
      country: "Japan",
      tags: ["quiet"],
      brewMethods: ["pour-over"],
      rating: 5,
      priceBand: 3,
      recommended: true,
      visits: ["2024-04-01"],
    }),
    shop({
      slug: "busy-tokyo",
      name: "Busy Tokyo",
      city: "Tokyo",
      region: "Kanto",
      country: "Japan",
      tags: ["buzzy"],
      brewMethods: ["espresso"],
      rating: 3,
      priceBand: 1,
      visits: ["2023-01-05"],
    }),
    shop({
      slug: "oslo-bar",
      name: "Oslo Bar",
      city: "Oslo",
      region: "Oslo",
      country: "Norway",
      tags: ["quiet"],
      brewMethods: ["espresso", "pour-over"],
      rating: 4,
      priceBand: 2,
      recommended: true,
      visits: ["2022-06-11"],
    }),
  ];

  const slugs = (result: CoffeeShop[]) => result.map((entry) => entry.slug);

  it("returns everything when nothing is set", () => {
    expect(applyFilters(dataset, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("ORs within a category", () => {
    expect(
      slugs(applyFilters(dataset, filters({ cities: ["Tokyo", "Oslo"] }))),
    ).toHaveLength(3);
  });

  it("ANDs across categories", () => {
    expect(
      slugs(applyFilters(dataset, filters({ cities: ["Tokyo"], tags: ["quiet"] }))),
    ).toEqual(["quiet-tokyo"]);
  });

  it("treats a multi-word query as terms that must all match", () => {
    expect(slugs(applyFilters(dataset, filters({ query: "quiet tokyo" })))).toEqual([
      "quiet-tokyo",
    ]);
    expect(applyFilters(dataset, filters({ query: "quiet reykjavik" }))).toEqual([]);
  });

  it("searches case-insensitively across place and note fields", () => {
    expect(slugs(applyFilters(dataset, filters({ query: "NORWAY" })))).toEqual([
      "oslo-bar",
    ]);
  });

  it("filters by minimum rating inclusively", () => {
    expect(slugs(applyFilters(dataset, filters({ minRating: 4 })))).toEqual([
      "quiet-tokyo",
      "oslo-bar",
    ]);
  });

  it("filters by recommendation, price band, and visit year", () => {
    expect(slugs(applyFilters(dataset, filters({ recommendedOnly: true })))).toEqual([
      "quiet-tokyo",
      "oslo-bar",
    ]);
    expect(slugs(applyFilters(dataset, filters({ priceBands: [1] })))).toEqual([
      "busy-tokyo",
    ]);
    expect(slugs(applyFilters(dataset, filters({ years: ["2022"] })))).toEqual([
      "oslo-bar",
    ]);
  });

  it("matches a shop carrying any one of the selected brew methods", () => {
    expect(
      slugs(applyFilters(dataset, filters({ brewMethods: ["pour-over"] }))),
    ).toEqual(["quiet-tokyo", "oslo-bar"]);
  });

  it("sorts by most recent visit by default", () => {
    expect(slugs(applyFilters(dataset, EMPTY_FILTERS))).toEqual([
      "quiet-tokyo",
      "busy-tokyo",
      "oslo-bar",
    ]);
  });

  it("supports the other sort orders", () => {
    expect(slugs(applyFilters(dataset, filters({ sort: "rating" })))).toEqual([
      "quiet-tokyo",
      "oslo-bar",
      "busy-tokyo",
    ]);
    expect(slugs(applyFilters(dataset, filters({ sort: "name" })))).toEqual([
      "busy-tokyo",
      "oslo-bar",
      "quiet-tokyo",
    ]);
    expect(slugs(applyFilters(dataset, filters({ sort: "city" })))).toEqual([
      "oslo-bar",
      "busy-tokyo",
      "quiet-tokyo",
    ]);
  });

  it("does not mutate the array it is given", () => {
    const input = [...dataset];
    applyFilters(input, filters({ sort: "name" }));
    expect(slugs(input)).toEqual(slugs(dataset));
  });

  it("returns an empty list rather than throwing when nothing matches", () => {
    expect(applyFilters(dataset, filters({ cities: ["Atlantis"] }))).toEqual([]);
  });
});

describe("active filter accounting", () => {
  it("does not count sort order as a filter", () => {
    const sorted = filters({ sort: "name" });
    expect(hasActiveFilters(sorted)).toBe(false);
    expect(countActiveFilters(sorted)).toBe(0);
  });

  it("counts each selected value", () => {
    const active = filters({
      query: "tokyo",
      cities: ["Tokyo", "Oslo"],
      tags: ["quiet"],
      minRating: 4,
      recommendedOnly: true,
    });
    expect(hasActiveFilters(active)).toBe(true);
    expect(countActiveFilters(active)).toBe(6);
  });
});

describe("deriveFacets", () => {
  it("derives options from the data with counts", () => {
    const facets = deriveFacets([
      shop({ slug: "a", city: "Tokyo", country: "Japan", tags: ["quiet"] }),
      shop({ slug: "b", city: "Tokyo", country: "Japan", tags: ["quiet", "buzzy"] }),
      shop({ slug: "c", city: "Oslo", country: "Norway", tags: [] }),
    ]);

    expect(facets.cities).toEqual([
      { value: "Tokyo", label: "Tokyo", count: 2 },
      { value: "Oslo", label: "Oslo", count: 1 },
    ]);
    expect(facets.tags[0]).toEqual({ value: "quiet", label: "quiet", count: 2 });
  });

  it("labels price bands with currency symbols in ascending order", () => {
    const facets = deriveFacets([
      shop({ slug: "a", priceBand: 3 }),
      shop({ slug: "b", priceBand: 1 }),
    ]);
    expect(facets.priceBands.map((band) => band.label)).toEqual(["$", "$$$"]);
  });

  it("lists visit years newest first", () => {
    const facets = deriveFacets([
      shop({ slug: "a", visits: ["2022-01-01"] }),
      shop({ slug: "b", visits: ["2024-01-01", "2023-05-05"] }),
    ]);
    expect(facets.years.map((year) => year.value)).toEqual(["2024", "2023", "2022"]);
  });

  it("covers every option present in the real dataset", () => {
    const facets = deriveFacets(SHOPS);
    expect(facets.countries.length).toBeGreaterThan(1);
    expect(
      facets.cities.reduce((sum, city) => sum + city.count, 0),
    ).toBe(SHOPS.length);
  });
});

describe("derivePlaces", () => {
  const dataset = [
    shop({ slug: "a", city: "Tokyo", region: "Kanto", country: "Japan", coords: [139.7, 35.7] }),
    shop({ slug: "b", city: "Tokyo", region: "Kanto", country: "Japan", coords: [139.6, 35.6] }),
    shop({ slug: "c", city: "Oslo", region: "Oslo", country: "Norway", coords: [10.7, 59.9] }),
  ];

  it("indexes cities, regions, and countries that have shops", () => {
    const places = derivePlaces(dataset);
    const names = places.map((place) => `${place.kind}:${place.name}`);

    expect(names).toContain("city:Tokyo");
    expect(names).toContain("region:Kanto");
    expect(names).toContain("country:Japan");
    expect(names).toContain("country:Norway");
  });

  it("skips a region whose name only repeats its city", () => {
    const places = derivePlaces(dataset);
    expect(places.some((place) => place.kind === "region" && place.name === "Oslo")).toBe(
      false,
    );
  });

  it("computes bounds and centre spanning the matching shops", () => {
    const tokyo = derivePlaces(dataset).find(
      (place) => place.kind === "city" && place.name === "Tokyo",
    );

    expect(tokyo?.count).toBe(2);
    expect(tokyo?.bounds).toEqual([139.6, 35.6, 139.7, 35.7]);
    expect(tokyo?.center[0]).toBeCloseTo(139.65);
    expect(tokyo?.center[1]).toBeCloseTo(35.65);
  });

  it("disambiguates cities with their region and country", () => {
    const tokyo = derivePlaces(dataset).find(
      (place) => place.kind === "city" && place.name === "Tokyo",
    );
    expect(tokyo?.context).toBe("Kanto, Japan");
  });

  it("orders cities before regions before countries", () => {
    const kinds = derivePlaces(dataset).map((place) => place.kind);
    expect(kinds.indexOf("city")).toBeLessThan(kinds.indexOf("region"));
    expect(kinds.indexOf("region")).toBeLessThan(kinds.indexOf("country"));
  });

  it("keeps every real shop reachable from a place in the index", () => {
    const cityNames = new Set(
      derivePlaces(SHOPS)
        .filter((place) => place.kind === "city")
        .map((place) => place.name),
    );
    expect(SHOPS.every((entry) => cityNames.has(entry.city))).toBe(true);
  });
});

describe("filtersForPlace", () => {
  const places = derivePlaces(SHOPS);
  const city = places.find((place) => place.kind === "city" && place.name === "Tokyo")!;
  const country = places.find(
    (place) => place.kind === "country" && place.name === "Japan",
  )!;

  it("applies a city selection as a city filter", () => {
    expect(filtersForPlace(EMPTY_FILTERS, city)).toMatchObject({
      cities: ["Tokyo"],
      regions: [],
      countries: [],
    });
  });

  it("replaces any previous geographic selection", () => {
    const next = filtersForPlace(filters({ cities: ["Oslo"] }), country);
    expect(next.countries).toEqual(["Japan"]);
    expect(next.cities).toEqual([]);
  });

  it("leaves non-geographic filters alone", () => {
    const next = filtersForPlace(
      filters({ tags: ["quiet"], minRating: 4, sort: "rating" }),
      city,
    );
    expect(next.tags).toEqual(["quiet"]);
    expect(next.minRating).toBe(4);
    expect(next.sort).toBe("rating");
  });

  it("selects a real subset of the atlas", () => {
    const results = applyFilters(SHOPS, filtersForPlace(EMPTY_FILTERS, city));
    expect(results.length).toBe(city.count);
    expect(results.every((entry) => entry.city === "Tokyo")).toBe(true);
  });
});
