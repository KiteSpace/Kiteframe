import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  optimizeDeps: {
    // MapLibre loads its tile/GeoJSON worker from a sibling file. Pre-bundling
    // relocates that worker; skipping it keeps clustering and markers working
    // in dev without extra Vite fs rules.
    exclude: ["maplibre-gl"],
  },
});
