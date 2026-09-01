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
      /*
       * skipFull drops files already at 100% from the text table only —
       * the recurring Operational-Loop run emitted ~60 zero-signal rows
       * here. Coverage math, the perFile 90% gate, and the html/json
       * reporters consumed by CI and scripts/rollup-coverage.js are
       * untouched; a file below 100% still shows, below 90% still fails.
       */
      reporter: [["text", { skipFull: true }], "html", "json-summary", "json"],
    },
  },
});
