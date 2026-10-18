import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const TEST_DATA_DIR = "/src/test-data/";

/*
 * Mock credential strings that must never ship in a live bundle — kept in
 * sync with src/test-data/adminUser.ts by tests/viteConfig.test.ts.
 */
export const FORBIDDEN_LIVE_STRINGS = ["mock-password"];

interface BundleModule {
  renderedLength: number;
}

interface BundleEntry {
  type: "chunk" | "asset";
  fileName: string;
  code?: string;
  source?: string | Uint8Array;
  modules?: Record<string, BundleModule>;
}

/** Every reason `bundle` would leak mock data into a live deployment; empty when clean. */
export function findLiveBundleLeaks(bundle: Record<string, BundleEntry>): string[] {
  const leaks: string[] = [];
  for (const entry of Object.values(bundle)) {
    for (const [id, module] of Object.entries(entry.modules ?? {})) {
      if (id.includes(TEST_DATA_DIR) && module.renderedLength > 0) {
        leaks.push(`${entry.fileName} includes test-data module ${id.slice(id.indexOf(TEST_DATA_DIR) + 1)}`);
      }
    }
    const text = entry.code ?? (typeof entry.source === "string" ? entry.source : "");
    for (const forbidden of FORBIDDEN_LIVE_STRINGS) {
      if (text.includes(forbidden)) {
        leaks.push(`${entry.fileName} contains mock credential "${forbidden}"`);
      }
    }
  }
  return leaks;
}

/**
 * Fails a `VITE_DATA_MODE=live` build (the pipeline's) if mock data or a
 * mock credential reaches the bundle (v1-prod-deployment.md A15/F2). Mock
 * builds legitimately include test-data, so they're not checked.
 */
export function liveBundleGuard(): Plugin {
  let isLive = false;
  return {
    name: "live-bundle-guard",
    apply: "build",
    configResolved(resolved) {
      isLive = resolved.env.VITE_DATA_MODE === "live";
    },
    generateBundle(_options, bundle) {
      if (!isLive) return;
      const leaks = findLiveBundleLeaks(bundle as unknown as Record<string, BundleEntry>);
      if (leaks.length > 0) {
        this.error(`Live bundle leaks mock data:\n  ${leaks.join("\n  ")}`);
      }
    },
  };
}

/*
 * Minified-byte budgets for known heavy, lazy-loaded chunks — Mapv2's own
 * page chunk and the three.js kit it shares with the Residents 3-D figures
 * (`14-maps-refactor.md` §4.9's "add a size check in CI" TODO). ~20%
 * headroom over the measured size on 2026-10-18 so routine churn doesn't
 * flake, while a real regression (e.g. a new heavy dependency) still fails
 * the build instead of only tripping Vite's easy-to-miss advisory warning.
 */
export const CHUNK_SIZE_BUDGETS_BYTES: Record<string, number> = {
  MapV2Page: 1_300_000,
  threeKit: 650_000,
};

/** Every tracked chunk over its CHUNK_SIZE_BUDGETS_BYTES entry; empty when clean. */
export function findBundleBudgetViolations(bundle: Record<string, BundleEntry>): string[] {
  const sizeByBudgetKey = new Map<string, number>();
  for (const entry of Object.values(bundle)) {
    if (entry.type !== "chunk") continue;
    const key = Object.keys(CHUNK_SIZE_BUDGETS_BYTES).find((candidate) => entry.fileName.includes(`${candidate}-`));
    if (!key) continue;
    const size = Buffer.byteLength(entry.code ?? "", "utf8");
    sizeByBudgetKey.set(key, (sizeByBudgetKey.get(key) ?? 0) + size);
  }
  const violations: string[] = [];
  for (const [key, budget] of Object.entries(CHUNK_SIZE_BUDGETS_BYTES)) {
    const size = sizeByBudgetKey.get(key);
    if (size !== undefined && size > budget) {
      violations.push(`${key} chunk is ${size.toLocaleString()} bytes minified, over its ${budget.toLocaleString()}-byte budget`);
    }
  }
  return violations;
}

/**
 * Fails any build where a tracked heavy chunk regresses past
 * CHUNK_SIZE_BUDGETS_BYTES (`14-maps-refactor.md` §4.9). Runs for every
 * build, mock and live alike, unlike `liveBundleGuard` below.
 */
export function bundleSizeBudgetGuard(): Plugin {
  return {
    name: "bundle-size-budget-guard",
    apply: "build",
    generateBundle(_options, bundle) {
      const violations = findBundleBudgetViolations(bundle as unknown as Record<string, BundleEntry>);
      if (violations.length > 0) {
        this.error(`Bundle size budget exceeded:\n  ${violations.join("\n  ")}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), liveBundleGuard(), bundleSizeBudgetGuard()],
  build: {
    rolldownOptions: {
      /*
       * test-data/ is pure data: declaring it side-effect-free lets a live
       * build drop it entirely once the mock services are tree-shaken, even
       * where a file builds its data with top-level calls like `row(...)`.
       */
      treeshake: {
        moduleSideEffects: (id: string) => !id.includes(TEST_DATA_DIR),
      },
    },
  },
});
