import { defineConfig } from "vitest/config";

// Real-integration tier (testing-framework.md §4) — hits a live deployed
// AWS environment over the network, so it's deliberately its own config
// with no coverage gate: coverage is already fully enforced by the unit
// tier (vitest.config.ts), and endpoint coverage (testing-framework.md §5)
// isn't wired up as a machine-checked gate yet (1-data-ingestion.md §8a).
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    testTimeout: 30000,
  },
});
