import { defineConfig, devices } from "@playwright/test";

import { E2E_NEXTAUTH_SECRET } from "./tests/e2e/auth-fixture";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"]
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/uz",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXTAUTH_SECRET: E2E_NEXTAUTH_SECRET,
      NEXTAUTH_URL: "http://127.0.0.1:3000",
      GOOGLE_CLIENT_ID: "playwright-google-client-id",
      GOOGLE_CLIENT_SECRET: "playwright-google-client-secret"
    },
    timeout: 120_000
  }
});
