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

export default defineConfig({
  plugins: [react(), tailwindcss(), liveBundleGuard()],
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
