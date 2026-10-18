import { defineConfig } from "@playwright/test";

/*
 * Real-browser smoke tests (docs/14-maps-refactor.md §4.8), run against a
 * deployed environment rather than a dev server. Headless Chromium has no
 * GPU in CodeBuild, so WebGL runs on SwiftShader (software).
 */
export default defineConfig({
  testDir: "tests/smoke",
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "https://test.boroughsim.com",
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
});
