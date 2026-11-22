import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

// Same server and browser as the e2e suite, but only the screenshot capture (e2e/*.capture.ts).
export default defineConfig({
  ...baseConfig,
  testMatch: "**/*.capture.ts",
  retries: 0,
  reporter: "list",
});
