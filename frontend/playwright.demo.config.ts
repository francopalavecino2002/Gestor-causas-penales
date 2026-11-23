import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// The demo flow (T32) runs against the real backend with the `dev,demo` profiles on :8081 and its
// fictitious seed, not against mocks. scripts/e2e-demo.sh starts everything on a fresh database.
if (!process.env.DEMO_PASSWORD) {
  throw new Error(
    "DEMO_PASSWORD is not set: run `bash scripts/e2e-demo.sh` (docs/DEMO.md, «Pruebas de punta a punta»).",
  );
}

export default defineConfig({
  testDir: "./e2e-demo",
  // One worker: the suite shares one seeded firm and the 2FA test changes a user for a while.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // No retries: the suite writes to the database (2FA, imports), so a retry after a half-finished
  // test would fail for an unrelated reason and hide the first failure.
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The production build, whose preview server proxies /api to the backend on :8081.
  webServer: {
    command: "npm run build && npm run preview",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
