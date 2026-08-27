# Coffee Atlas

A self-contained section of the app for logging coffee shops: a clustered globe
map, a catalogue grid, and a journal. Routes live under `/coffee`.

## Why it has no backend

`server/db.ts` throws at import time when `DATABASE_URL` is unset, so anything
that goes through the Express server cannot boot without Postgres. The atlas is
therefore entirely client-side — content is typed data and markdown compiled
into the bundle — which means:

- `npm run dev:client` (plain Vite, no Express) is enough to work on it.
- `npm run build` produces a fully static, deployable atlas with no secrets.
- There is no API, no migration, and no seeding step.

If it ever needs a database, `shared/coffee/` is the layer to move behind an
API; nothing else knows where the data comes from.

## Layout

```
shared/coffee/
  types.ts        zod schemas + types for shops, photos, journal posts
  shops.ts        the shop dataset (validated at module load)
  photo-pool.ts   GENERATED — openly-licensed stand-in photography
client/src/coffee/
  filters.ts      filter state, matching, facets, and the place index
  useShopFilters.ts   the query-string-backed hook both views read
  coffee-theme.css    warm palette, scoped to `.coffee-theme`
  components/     layout, filter bar, place search, cards, gallery
  map/            MapLibre globe with clustering
  content/        journal markdown + frontmatter reader
client/src/pages/coffee/    the five routed pages
client/public/coffee/photos/    image files
```

## Map and catalogue share one filter state

Both views call `useShopFilters()`, which parses the query string. That is what
makes "5 of 22 shops" mean the same five shops in both, keeps filters intact
when switching views, and makes any filtered view a shareable link. There is no
second code path to keep in sync.

Filtering is **AND across categories, OR within one**: two cities widens to
either city, adding a tag narrows to shops in those cities that also carry it.

## Adding a shop

Add an entry to `RAW_SHOPS` in [`shared/coffee/shops.ts`](../../../shared/coffee/shops.ts).
The zod schema validates it at module load, so a bad field throws immediately
with the offending path rather than rendering an empty tile.

Nothing else needs updating — the filter facets, the city/region/country search
index, and the map source are all derived from the dataset. A shop in a new
country makes that country filterable automatically.

`sample: true` marks an entry as seeded placeholder content and shows a note in
the UI. **Remove it once the entry describes a real visit of your own.**

## Adding photos

Two options:

1. **Your own photos.** Drop files into `client/public/coffee/photos/` and
   reference them directly:

   ```ts
   photos: [
     {
       src: "/coffee/photos/my-photo.jpg",
       alt: "The corner window seat",
       credit: "Me",
       license: "All rights reserved",
       isPlaceholder: false,
     },
   ]
   ```

2. **Openly-licensed stand-ins.** Use `pooledPhoto("<key>", "alt text")` with a
   key from `PHOTO_POOL` in `shared/coffee/photo-pool.ts`.

To refresh the pool:

```bash
node scripts/fetch-coffee-photos.mjs
```

It searches Wikimedia Commons, keeps only CC0 / public domain / CC BY / CC BY-SA
files, downscales them to 1200px with ffmpeg, and regenerates
`shared/coffee/photo-pool.ts` with the author and licence for each. Attribution
accumulates in `scripts/coffee-photo-credits.json`, and the generated module
lists only entries whose image is on disk — so to drop a photo, delete the file
and add its key to `REJECTED_KEYS` in the script so the next run does not fetch
it again.

Every photo carries a credit and licence, and the gallery displays them. Keep it
that way: the licences require it.

## Adding a journal post

Create `client/src/coffee/content/posts/<slug>.md`. The filename becomes the
slug and nothing needs registering — `import.meta.glob` picks it up.

```markdown
---
title: A title
date: 2024-06-08
excerpt: One or two sentences for the index page.
tags: [tokyo, opinion]
shops:
  - fuglen-tokyo
coverImage: /coffee/photos/some-photo.jpg
---

Body in markdown.
```

`readingMinutes` is estimated from word count unless you set it. `shops` slugs
render as linked cards under the post and are resolved defensively, so a stale
slug is skipped rather than crashing the page.

The frontmatter reader
([`content/frontmatter.ts`](content/frontmatter.ts)) covers strings, numbers,
booleans, and flat lists — enough for the fields above, without a YAML
dependency. It does not handle nested maps or multi-line scalars.

## The basemap

Defaults to [OpenFreeMap](https://openfreemap.org/), which serves
OpenStreetMap-derived vector tiles with no API key and no account, so the atlas
stays deployable with no secrets. It also supplies the glyph endpoint that the
cluster count labels need. `positron` is used in light mode and `dark` in dark
mode.

To use a different basemap, set `VITE_COFFEE_MAP_STYLE_URL` to its style URL,
including any key:

```bash
VITE_COFFEE_MAP_STYLE_URL="https://api.maptiler.com/maps/streets/style.json?key=..." npm run dev:client
```

A custom style needs a `background` layer for the ocean tint to apply and a font
from `CLUSTER_LABEL_FONTS` for the cluster counts; both degrade quietly if
absent.

The map needs WebGL. If the browser cannot provide it, the map view says so and
points at the catalogue, which shows the same shops under the same filters.

### Debugging the map

In dev builds the MapLibre instance is on `window.__coffeeMap`, so you can
inspect it from the console or a browser test:

```js
__coffeeMap.getStyle().layers.map((l) => l.id);
__coffeeMap.queryRenderedFeatures([x, y], { layers: ["atlas-pins"] });
```

One gotcha worth knowing: under the globe projection,
`queryRenderedFeatures()` with no geometry returns nothing. Point and box
queries work fine, which is why marker clicks still work — but a whole-viewport
query is not a valid way to check whether markers rendered.

## Tests

```bash
npx vitest run --config vitest.config.ts client/src/coffee
```

Covers filter parsing and round-tripping, the AND/OR matching rules, facet and
place derivation, the frontmatter reader, and the integrity of the real content
(every journal `shops` slug resolves, every shop validates).
