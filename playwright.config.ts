import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL } from "./tests/e2e/global-setup";

// Section 24.3: "Use Playwright to simulate complete user journeys such as
// registration -> chat -> trip creation -> itinerary -> budget ->
// modification -> save -> reload." globalSetup/globalTeardown spin up a
// real app instance against a throwaway local database — see
// global-setup.ts for why and how.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1, // single shared server/database — tests must not race each other
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
