import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  webServer: [
    {
      command: "npm run start --workspace=server",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev --workspace=client",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});