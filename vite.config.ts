import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  optimizeDeps: {
    // MapLibre spawns its tile/GeoJSON worker from a file next to its own
    // bundle. Pre-bundling relocates that file into node_modules/.vite/deps/,
    // which the `server.fs.deny` rule below refuses to serve because of the
    // leading dot — the worker 404s, and since GeoJSON sources are parsed and
    // clustered in the worker, map markers silently never appear in dev.
    // Skipping pre-bundling keeps the worker inside node_modules/maplibre-gl/
    // where it can be served. Safe here because the published ESM build is
    // self-contained and has no bare imports to resolve.
    exclude: ["maplibre-gl"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
