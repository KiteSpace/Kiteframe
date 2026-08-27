# Coffee Atlas

A standalone Vite + React app for logging coffee shops: a clustered globe map,
a catalogue grid, and a journal.

This folder is a complete app of its own. It does not import anything from
Kiteframe. Copy it into a separate repository to publish it independently.

```bash
cd coffee-atlas
npm install
npm run dev
```

Routes:

- `/` redirects to `/map`
- `/map` — clustered globe
- `/grid` — catalogue of tiles
- `/shops/:slug` — shop write-up
- `/journal` and `/journal/:slug` — markdown posts

Map and catalogue share one filter state via the query string
(`useShopFilters`), so the two views cannot drift.

## Why there is no backend

Content is typed data and markdown compiled into the bundle. The app builds
and deploys as static output with no database, no API, and no secrets.

If it ever needs a database, `shared/coffee/` is the layer to move behind an
API; nothing else knows where the data comes from.

## Layout

```
shared/coffee/
  types.ts        zod schemas + types for shops, photos, journal posts
  shops.ts        the shop dataset (validated at module load)
  photo-pool.ts   GENERATED — openly-licensed stand-in photography
src/coffee/
  filters.ts      filter state, matching, facets, and the place index
  useShopFilters.ts   the query-string-backed hook both views read
  coffee-theme.css    editorial palette
  components/     layout, filter bar, place search, cards, gallery
  map/            MapLibre globe with clustering
  content/        journal markdown + frontmatter reader
src/pages/        the five routed pages
public/coffee/photos/    image files
```

## Adding a shop

Add an entry to `RAW_SHOPS` in [`shared/coffee/shops.ts`](shared/coffee/shops.ts).
The zod schema validates it at module load.

Nothing else needs updating — filter facets, the city/region/country search
index, and the map source are all derived from the dataset.

`sample: true` marks an entry as seeded placeholder content. Remove it once
the entry describes a real visit of your own.

## Adding photos

1. **Your own photos.** Drop files into `public/coffee/photos/` and reference
   them directly:

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
npm run photos
```

It searches Wikimedia Commons, keeps only CC0 / public domain / CC BY / CC BY-SA
files, downscales them to 1200px with ffmpeg, and regenerates
`shared/coffee/photo-pool.ts`. Attribution accumulates in
`scripts/coffee-photo-credits.json`.

## Adding a journal post

Create `src/coffee/content/posts/<slug>.md`. The filename becomes the slug and
`import.meta.glob` picks it up.

## The basemap

Defaults to [OpenFreeMap](https://openfreemap.org/) (`positron` in light mode,
`dark` in dark mode). No API key. Override with `VITE_COFFEE_MAP_STYLE_URL`.

## Tests

```bash
npm test
```

Covers filter parsing and round-tripping, the AND/OR matching rules, facet and
place derivation, the frontmatter reader, and content integrity.
