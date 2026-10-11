import { defineConfig, devices } from "@playwright/test";

// Browser-only synthetic DTO tests: no DB discovery, fixtures or credentials.
export default defineConfig({
  testDir: "./e2e", testMatch: "public-event-viewer.spec.ts", workers: 1, retries: 0,
  outputDir: process.env.PUBLIC_EVENT_BROWSER_ARTIFACTS ?? "test-results/public-event",
  reporter: "list", use: { baseURL: "http://127.0.0.1:3100", trace: "off", video: "off" },
  projects: [ { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } } ],
  webServer: { command: "pnpm exec next start --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/share/event",
    reuseExistingServer: false, timeout: 120000,
    env: { APP_ENV: "local", SHARE_LINK_INTERFACE_ENABLED: "true", PUBLIC_EVENT_VIEWER_ENABLED: "true" } },
});
