import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/routes/**/*.{ts,tsx}",
        "src/services/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
        "src/models/**/*.{ts,tsx}",
        "src/config.ts",
      ],
      exclude: ["**/*.d.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        perFile: true,
      },
      reporter: ["text", "html", "json-summary", "json"],
    },
  },
});
