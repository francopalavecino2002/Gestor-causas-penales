import { defineConfig } from "@playwright/test";

import demoConfig from "./playwright.demo.config";

// Same server, backend and browser as the demo flow, but only the screenshot capture
// (e2e-demo/*.capture.ts). Run it with `bash scripts/e2e-demo.sh --screenshots` (T33).
export default defineConfig({
  ...demoConfig,
  testMatch: "**/*.capture.ts",
  reporter: "list",
});
