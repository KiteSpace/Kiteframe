import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CoffeeShop } from "@shared/coffee/types";
import { CLUSTER_COLORS, mapStyleFor } from "./mapStyle";
import { useDarkMode } from "./useDarkMode";

const SOURCE_ID = "atlas-shops";
const CLUSTER_LAYER = "atlas-clusters";
const CLUSTER_COUNT_LAYER = "atlas-cluster-count";
const PIN_LAYER = "atlas-pins";
const PIN_RING_LAYER = "atlas-pin-rings";

/** Zoomed far enough out that the globe reads as a globe. */
const INITIAL_ZOOM = 1.1;

export interface GlobeMapHandle {
  /** Frames a place's extent; used by the region/city search. */
  flyToBounds: (bounds: [number, number, number, number]) => void;
  /** Returns to the whole-globe view. */
  resetView: () => void;
}

interface GlobeMapProps {
  shops: CoffeeShop[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  /** Rendered inside the map popup for the selected shop. */
  renderPopup: (shop: CoffeeShop) => React.ReactNode;
}

function toFeatureCollection(shops: CoffeeShop[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: shops.map((shop) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: shop.coords },
      properties: {
        slug: shop.slug,
        name: shop.name,
        recommended: shop.recommended ? 1 : 0,
      },
    })),
  };
}

/**
 * The atlas map: a globe when zoomed out, clustered pins as you zoom in.
 *
 * MapLibre is driven imperatively through refs rather than wrapped in a
 * declarative component. The map instance survives filter changes — only the
 * GeoJSON source data is replaced — so clusters recompute in place instead of
 * the map being torn down and rebuilt on every keystroke.
 */
export const GlobeMap = forwardRef<GlobeMapHandle, GlobeMapProps>(
  function GlobeMap({ shops, selectedSlug, onSelect, renderPopup }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const popupRef = useRef<Popup | null>(null);
    const styleReadyRef = useRef(false);
    /** Set while we close a popup ourselves, so the close handler stays quiet. */
    const closingRef = useRef(false);

    const dark = useDarkMode();
    const [popupShop, setPopupShop] = useState<CoffeeShop | null>(null);
    const [failed, setFailed] = useState<string | null>(null);

    const data = useMemo(() => toFeatureCollection(shops), [shops]);

    // Kept in a ref so map event handlers registered once always see the
    // latest values without needing to be torn down and re-attached.
    const latest = useRef({ shops, onSelect, data });
    latest.current = { shops, onSelect, data };

    /** A single DOM node reused for every popup, rendered into by React. */
    const popupNode = useMemo(() => {
      if (typeof document === "undefined") return null;
      const node = document.createElement("div");
      node.className = "coffee-map-popup";
      return node;
    }, []);

    const addAtlasLayers = useCallback((map: MapLibreMap) => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: latest.current.data,
        cluster: true,
        clusterRadius: 46,
        // Stop clustering once cities are distinguishable, so individual shops
        // in the same city separate rather than staying merged.
        clusterMaxZoom: 11,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            CLUSTER_COLORS.small,
            3,
            CLUSTER_COLORS.medium,
            6,
            CLUSTER_COLORS.large,
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            15,
            3,
            19,
            6,
            24,
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "rgba(255,255,255,0.85)",
          "circle-opacity": 0.92,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold", "Open Sans Semibold"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      // A wider translucent ring under each pin keeps single shops visible
      // against busy tiles without making the dot itself heavy.
      map.addLayer({
        id: PIN_RING_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 13,
          "circle-color": CLUSTER_COLORS.pin,
          "circle-opacity": 0.18,
        },
      });

      map.addLayer({
        id: PIN_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "case",
            ["==", ["get", "recommended"], 1],
            CLUSTER_COLORS.pinRecommended,
            CLUSTER_COLORS.pin,
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "rgba(255,255,255,0.92)",
        },
      });
    }, []);

    // --- Map creation, once for the life of the component.
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      let map: MapLibreMap;
      try {
        map = new MapLibreMap({
          container: containerRef.current,
          style: mapStyleFor(dark ? "dark" : "light"),
          center: [10, 25],
          zoom: INITIAL_ZOOM,
          minZoom: 0.6,
          maxZoom: 17,
          attributionControl: { compact: true },
          // The globe's poles are meaningless to drag past.
          maxPitch: 0,
        });
      } catch (error) {
        // Almost always a missing WebGL context (headless browsers, blocked
        // hardware acceleration). Surface it instead of rendering a blank box.
        setFailed(
          error instanceof Error ? error.message : "The map could not start.",
        );
        return;
      }

      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (event) => {
        // Tile and glyph fetch failures are noisy but not fatal; only report
        // the ones that leave the map unusable.
        if (!mapRef.current) return;
        console.warn("[coffee-atlas] map error", event.error?.message);
      });

      const onStyleReady = () => {
        map.setProjection({ type: "globe" });
        addAtlasLayers(map);
        styleReadyRef.current = true;
      };

      map.on("style.load", onStyleReady);

      const openFor = (feature: MapGeoJSONFeature) => {
        const slug = feature.properties?.slug as string | undefined;
        if (slug) latest.current.onSelect(slug);
      };

      map.on("click", PIN_LAYER, (event) => {
        if (event.features?.[0]) openFor(event.features[0]);
      });

      // Clicking a cluster zooms to the point where it breaks apart.
      map.on("click", CLUSTER_LAYER, async (event) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;

        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!source) return;

        try {
          const zoom = await source.getClusterExpansionZoom(Number(clusterId));
          const geometry = feature!.geometry;
          if (geometry.type !== "Point") return;
          map.easeTo({
            center: geometry.coordinates as [number, number],
            zoom: Math.min(zoom + 0.25, 16),
            duration: 650,
          });
        } catch {
          // A stale cluster id after a filter change; the next click works.
        }
      });

      // Clicking empty map clears the selection.
      map.on("click", (event) => {
        const hits = map.queryRenderedFeatures(event.point, {
          layers: [PIN_LAYER, CLUSTER_LAYER],
        });
        if (hits.length === 0) latest.current.onSelect(null);
      });

      for (const layer of [PIN_LAYER, CLUSTER_LAYER]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      return () => {
        closingRef.current = true;
        popupRef.current?.remove();
        popupRef.current = null;
        styleReadyRef.current = false;
        mapRef.current = null;
        map.remove();
      };
      // Theme is handled by its own effect; re-creating the map on a theme
      // change would throw away the user's current view.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addAtlasLayers]);

    // --- Filter changes: swap the source data, keep the view.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const push = () => {
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        source?.setData(data);
      };

      if (styleReadyRef.current && map.isStyleLoaded()) push();
      else map.once("style.load", push);
    }, [data]);

    // --- Theme changes: restyle, then re-add the atlas layers the new style
    // does not know about.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleReadyRef.current) return;

      styleReadyRef.current = false;
      map.setStyle(mapStyleFor(dark ? "dark" : "light"));
    }, [dark]);

    // --- Selection: fly to the shop and show its popup.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const shop = selectedSlug
        ? shops.find((entry) => entry.slug === selectedSlug)
        : undefined;

      if (!shop || !popupNode) {
        closingRef.current = true;
        popupRef.current?.remove();
        closingRef.current = false;
        popupRef.current = null;
        setPopupShop(null);
        return;
      }

      setPopupShop(shop);

      if (!popupRef.current) {
        const popup = new Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: "280px",
          offset: 14,
        });
        popup.setDOMContent(popupNode);
        // Dismissing the popup clears the selection, but only when the user did
        // it — not when we removed it to show a different shop.
        popup.on("close", () => {
          if (!closingRef.current) latest.current.onSelect(null);
        });
        popupRef.current = popup;
      }

      popupRef.current.setLngLat(shop.coords).addTo(map);

      // Only close the distance if the shop is off screen or the globe is still
      // zoomed way out; otherwise jumping the viewport is disorienting.
      const zoom = map.getZoom();
      const visible = map.getBounds().contains(shop.coords);
      if (!visible || zoom < 4) {
        map.easeTo({
          center: shop.coords,
          zoom: Math.max(zoom, 11),
          duration: 900,
        });
      }
    }, [selectedSlug, shops, popupNode]);

    useImperativeHandle(
      ref,
      () => ({
        flyToBounds: (bounds) => {
          const map = mapRef.current;
          if (!map) return;

          const [west, south, east, north] = bounds;
          // A single shop has no extent, so pad it into a small box.
          const pad = 0.06;
          const box: LngLatBoundsLike = [
            [west - pad, south - pad],
            [east + pad, north + pad],
          ];
          map.fitBounds(box, { padding: 80, maxZoom: 13, duration: 1200 });
        },
        resetView: () => {
          mapRef.current?.easeTo({
            center: [10, 25],
            zoom: INITIAL_ZOOM,
            duration: 900,
          });
        },
      }),
      [],
    );

    if (failed) {
      return (
        <div
          className="flex h-full items-center justify-center bg-muted p-8"
          data-testid="container-coffee-map-error"
        >
          <div className="max-w-sm text-center">
            <p className="font-medium">The map could not start</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This view needs WebGL. The catalogue shows the same shops as a
              grid, with the same filters.
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {failed}
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div
          ref={containerRef}
          className="h-full w-full"
          data-testid="container-coffee-map"
        />
        {popupNode && popupShop
          ? createPortal(renderPopup(popupShop), popupNode)
          : null}
      </>
    );
  },
);
