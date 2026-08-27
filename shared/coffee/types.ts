import { z } from "zod";

/**
 * Coffee Atlas content model.
 *
 * The atlas is deliberately database-free: every shop and journal post is a
 * typed literal in this folder, so the section builds and deploys as static
 * output with no `DATABASE_URL` and no API. The zod schemas below exist so a
 * typo in the content data fails loudly in development instead of rendering an
 * empty tile.
 */

export const SHOP_TAGS = [
  "laptop-friendly",
  "no-laptops",
  "outdoor-seating",
  "roaster-on-site",
  "great-pastries",
  "quiet",
  "buzzy",
  "counter-only",
  "cash-only",
  "dog-friendly",
  "tea-program",
  "late-hours",
  "great-view",
] as const;

export const BREW_METHODS = [
  "espresso",
  "pour-over",
  "batch-filter",
  "cold-brew",
  "aeropress",
  "siphon",
  "moka",
] as const;

export type ShopTag = (typeof SHOP_TAGS)[number];
export type BrewMethod = (typeof BREW_METHODS)[number];

/** Human labels for tag/brew slugs, used by the filter bar and shop cards. */
export const TAG_LABELS: Record<ShopTag, string> = {
  "laptop-friendly": "Laptop friendly",
  "no-laptops": "No laptops",
  "outdoor-seating": "Outdoor seating",
  "roaster-on-site": "Roaster on site",
  "great-pastries": "Great pastries",
  quiet: "Quiet",
  buzzy: "Buzzy",
  "counter-only": "Counter only",
  "cash-only": "Cash only",
  "dog-friendly": "Dog friendly",
  "tea-program": "Tea program",
  "late-hours": "Late hours",
  "great-view": "Great view",
};

export const BREW_LABELS: Record<BrewMethod, string> = {
  espresso: "Espresso",
  "pour-over": "Pour over",
  "batch-filter": "Batch filter",
  "cold-brew": "Cold brew",
  aeropress: "AeroPress",
  siphon: "Siphon",
  moka: "Moka",
};

export const PRICE_LABELS: Record<number, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
};

export const photoSchema = z.object({
  /** Absolute URL, or a path under `client/public` such as `/coffee/photos/x.jpg`. */
  src: z.string().min(1),
  alt: z.string().min(1),
  /** Photographer or source name. Required so open-licensed imagery stays credited. */
  credit: z.string().min(1),
  creditUrl: z.string().url().optional(),
  license: z.string().min(1),
  /**
   * True for stock/open-source imagery standing in for a photo of the actual
   * shop. The gallery labels these so nobody mistakes them for a real visit.
   */
  isPlaceholder: z.boolean().default(false),
});

export type Photo = z.infer<typeof photoSchema>;

/** `[longitude, latitude]` — GeoJSON order, which is what MapLibre expects. */
export const coordsSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export type Coords = z.infer<typeof coordsSchema>;

export const coffeeShopSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase kebab-case"),
  name: z.string().min(1),
  neighborhood: z.string().optional(),
  city: z.string().min(1),
  /** State, province, or wider metro area — the middle tier of place search. */
  region: z.string().min(1),
  country: z.string().min(1),
  coords: coordsSchema,
  /** ISO `YYYY-MM-DD` visit dates, most recent first. */
  visits: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  /** Out of 5, in half-star steps. */
  rating: z.number().min(0).max(5),
  priceBand: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(z.enum(SHOP_TAGS)),
  brewMethods: z.array(z.enum(BREW_METHODS)).min(1),
  /** Whether this one makes the shortlist worth travelling for. */
  recommended: z.boolean(),
  /** One-line "get this" recommendation shown on cards and map popups. */
  orderThis: z.string().min(1),
  /** Short summary used on tiles and map popups. */
  summary: z.string().min(1),
  /** Long-form review body, rendered as markdown on the detail page. */
  review: z.string().min(1),
  photos: z.array(photoSchema),
  website: z.string().url().optional(),
  /**
   * True while the entry is seeded sample content rather than a real visit of
   * your own. Surfaced in the UI so placeholder copy is never mistaken for a
   * first-hand review.
   */
  sample: z.boolean().default(false),
});

export type CoffeeShop = z.infer<typeof coffeeShopSchema>;

export const journalPostSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  excerpt: z.string().min(1),
  /** Free-form topic tags for the journal index. */
  tags: z.array(z.string()).default([]),
  /** Slugs of shops referenced by the post; rendered as linked cards. */
  shops: z.array(z.string()).default([]),
  coverImage: z.string().optional(),
  readingMinutes: z.number().int().positive(),
  body: z.string(),
});

export type JournalPost = z.infer<typeof journalPostSchema>;

/** Latest visit date for a shop, used for "recently visited" sorting. */
export function latestVisit(shop: CoffeeShop): string {
  return shop.visits.slice().sort().reverse()[0] ?? "";
}

/** Distinct four-digit years in which a shop was visited. */
export function visitYears(shop: CoffeeShop): string[] {
  return Array.from(new Set(shop.visits.map((visit) => visit.slice(0, 4))));
}
