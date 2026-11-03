/**
 * Basemap styles for the atlas globe.
 *
 * Deliberately API-key-free: OpenFreeMap serves OpenStreetMap-derived vector
 * tiles with no key and no account, which keeps the atlas deployable as static
 * output with no secrets. Vector tiles also stay crisp under the globe
 * projection and bring their own glyph endpoint, so the cluster count labels
 * render without a separate font source.
 *
 * To use a different basemap (MapTiler, Protomaps, a self-hosted style), set
 * `VITE_COFFEE_MAP_STYLE_URL` to its style URL — including any key — and it is
 * used for both themes instead.
 */

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

const OVERRIDE_STYLE_URL = import.meta.env.VITE_COFFEE_MAP_STYLE_URL as
  | string
  | undefined;

export function mapStyleFor(theme: "light" | "dark"): string {
  return OVERRIDE_STYLE_URL || STYLES[theme];
}

/**
 * Fonts to label cluster counts with. Both OpenFreeMap styles ship Noto Sans;
 * the second entry is a fallback for custom styles that do not.
 */
export const CLUSTER_LABEL_FONTS = ["Noto Sans Bold", "Open Sans Semibold"];

/**
 * Ocean colour applied to the style's `background` layer after it loads.
 *
 * OpenMapTiles has no ocean polygons at low zoom — sea is simply where land
 * isn't — so the backdrop colour is what makes the sphere read as a sphere.
 * Positron's near-white default leaves the globe looking like a pale smudge
 * against a pale page.
 */
export const OCEAN_COLOR = {
  light: "#cfdbe2",
  dark: "#101b21",
} as const;

/** Colour ramp for cluster bubbles and pins, from the atlas palette. */
export const CLUSTER_COLORS = {
  small: "#C97B45",
  medium: "#B55A28",
  large: "#8F3D1D",
  pin: "#B55A28",
  pinRecommended: "#8F3D1D",
  pinSelected: "#2D211A",
} as const;
