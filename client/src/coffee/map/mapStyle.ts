import type { StyleSpecification } from "maplibre-gl";

/**
 * Basemap styles for the atlas globe.
 *
 * Deliberately API-key-free by default: CARTO's raster basemaps need no token
 * and are free to use with attribution, which keeps the atlas deployable as
 * static output with no secrets. Raster tiles render correctly under the globe
 * projection, so the tradeoff is tile detail rather than functionality.
 *
 * To swap in a vector basemap (MapTiler, Protomaps, a self-hosted style), set
 * `VITE_COFFEE_MAP_STYLE_URL` to its style URL — including any key — and it is
 * used for both themes instead.
 */

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>';

function rasterStyle(basemap: "light_all" | "dark_all"): StyleSpecification {
  return {
    version: 8,
    // Fonts are only needed by symbol layers; the cluster labels below use this.
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      carto: {
        type: "raster",
        tiles: [
          `https://a.basemaps.cartocdn.com/rastertiles/${basemap}/{z}/{x}/{y}{r}.png`,
          `https://b.basemaps.cartocdn.com/rastertiles/${basemap}/{z}/{x}/{y}{r}.png`,
          `https://c.basemaps.cartocdn.com/rastertiles/${basemap}/{z}/{x}/{y}{r}.png`,
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATTRIBUTION,
      },
    },
    layers: [
      {
        // Painted behind the tiles so the globe's oceans are never transparent
        // while tiles are still loading.
        id: "background",
        type: "background",
        paint: {
          "background-color": basemap === "dark_all" ? "#14100e" : "#e8e2d9",
        },
      },
      {
        id: "carto-tiles",
        type: "raster",
        source: "carto",
        paint: { "raster-opacity": 1 },
      },
    ],
  };
}

const OVERRIDE_STYLE_URL = import.meta.env.VITE_COFFEE_MAP_STYLE_URL as
  | string
  | undefined;

export function mapStyleFor(theme: "light" | "dark"): StyleSpecification | string {
  if (OVERRIDE_STYLE_URL) return OVERRIDE_STYLE_URL;
  return rasterStyle(theme === "dark" ? "dark_all" : "light_all");
}

/** Colour ramp for cluster bubbles, from the atlas palette. */
export const CLUSTER_COLORS = {
  small: "#C97B45",
  medium: "#B55A28",
  large: "#8F3D1D",
  pin: "#B55A28",
  pinRecommended: "#8F3D1D",
  pinSelected: "#2D211A",
} as const;
