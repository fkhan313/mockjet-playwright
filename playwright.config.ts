import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";


dotenv.config({ path: path.resolve(__dirname, ".env") });

if (!process.env.BASE_URL) {
  throw new Error("BASE_URL is required");
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    //viewport: { width: 1920, height: 1080 },
    // viewport: null,
    // launchOptions: {
    //   args: ["--start-maximized"],
    //   //slowMo: 500,
    // },
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    // Line below should be removed eventually, run tests with npx playwright test --headed
    headless: !!process.env.CI,
    screenshot: "only-on-failure",
  },

  // Configure projects for major browsers

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // viewport: null,
        // deviceScaleFactor: undefined,
      },
    },

    /* {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    }, */

    /*{
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    }, */

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run start',
    cwd: './app',
    url: 'http://localhost:4000',
    reuseExistingServer: !process.env.CI,
  },
});
