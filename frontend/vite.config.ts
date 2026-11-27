import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// Backend runs on 8081 (ports 5432, 5433 and 8080 are reserved by other projects).
const BACKEND_URL = "http://localhost:8081";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Navigations to the backend must reach the network, never the SPA shell. In production the
      // backend serves this build on the same origin (ADR-0046), health checks included.
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/actuator\//] },
      // Placeholder icons generated from public/favicon.svg with @vite-pwa/assets-generator
      // (preset minimal-2023). Brand icons are pending (see docs/DECISIONS.md, T20).
      includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Gestor de causas penales",
        short_name: "Causas",
        description: "Agenda de audiencias y gestión de causas penales para estudios de defensa.",
        lang: "es-AR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Design tokens --primary and --background (docs/design/DESIGN.md).
        theme_color: "#0b5267",
        background_color: "#f4f7f8",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: BACKEND_URL, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": { target: BACKEND_URL, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
