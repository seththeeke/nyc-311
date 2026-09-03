import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /*
     * happy-dom over jsdom, and the threads pool over forks: this suite is
     * ~50 small RTL files whose cost is dominated by per-file DOM-env +
     * worker startup, not the assertions. Together they cut `npm run test`
     * from ~7.3s to ~4.3s locally with all 290 tests unchanged. web-app has
     * no native deps, so the threads pool is safe here.
     */
    environment: "happy-dom",
    pool: "threads",
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
