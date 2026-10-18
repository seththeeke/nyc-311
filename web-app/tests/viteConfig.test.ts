import { describe, expect, it } from "vitest";
import type { Plugin } from "vite";
import {
  bundleSizeBudgetGuard,
  CHUNK_SIZE_BUDGETS_BYTES,
  FORBIDDEN_LIVE_STRINGS,
  findBundleBudgetViolations,
  findLiveBundleLeaks,
  liveBundleGuard,
} from "../vite.config";
import { MOCK_ADMIN_CREDENTIAL } from "../src/test-data/adminUser";

const TEST_DATA_ID = "/repo/web-app/src/test-data/operators.ts";
const SERVICE_ID = "/repo/web-app/src/services/capacityService.ts";

type GenerateBundle = (this: { error: (message: string) => never }, options: unknown, bundle: unknown) => void;
type ConfigResolved = (config: { env: Record<string, string> }) => void;

function runGuard(dataMode: string, bundle: Record<string, unknown>): string | null {
  const plugin: Plugin = liveBundleGuard();
  (plugin.configResolved as unknown as ConfigResolved)({ env: { VITE_DATA_MODE: dataMode } });
  let error: string | null = null;
  const context = {
    error: (message: string): never => {
      error = message;
      throw new Error(message);
    },
  };
  try {
    (plugin.generateBundle as unknown as GenerateBundle).call(context, {}, bundle);
  } catch {
    /* error captured above */
  }
  return error;
}

describe("findLiveBundleLeaks", () => {
  it("returns nothing for a clean bundle, including a tree-shaken test-data module", () => {
    const bundle = {
      "index.js": {
        type: "chunk" as const,
        fileName: "assets/index.js",
        code: "console.log('live')",
        modules: { [SERVICE_ID]: { renderedLength: 120 }, [TEST_DATA_ID]: { renderedLength: 0 } },
      },
      "index.css": { type: "asset" as const, fileName: "assets/index.css", source: "body{}" },
    };
    expect(findLiveBundleLeaks(bundle)).toEqual([]);
  });

  it("flags a rendered test-data module", () => {
    const bundle = {
      "index.js": {
        type: "chunk" as const,
        fileName: "assets/index.js",
        code: "",
        modules: { [TEST_DATA_ID]: { renderedLength: 427 } },
      },
    };
    expect(findLiveBundleLeaks(bundle)).toEqual(["assets/index.js includes test-data module src/test-data/operators.ts"]);
  });

  it("flags a forbidden string in chunk code or a string asset, ignoring binary assets", () => {
    const bundle = {
      "index.js": { type: "chunk" as const, fileName: "assets/index.js", code: 'x="mock-password"' },
      "leak.txt": { type: "asset" as const, fileName: "leak.txt", source: "mock-password" },
      "logo.png": { type: "asset" as const, fileName: "logo.png", source: new Uint8Array([1, 2]) },
    };
    expect(findLiveBundleLeaks(bundle)).toEqual([
      'assets/index.js contains mock credential "mock-password"',
      'leak.txt contains mock credential "mock-password"',
    ]);
  });

  it("covers the mock admin password from test-data", () => {
    expect(FORBIDDEN_LIVE_STRINGS).toContain(MOCK_ADMIN_CREDENTIAL.password);
  });
});

function runBudgetGuard(bundle: Record<string, unknown>): string | null {
  const plugin: Plugin = bundleSizeBudgetGuard();
  let error: string | null = null;
  const context = {
    error: (message: string): never => {
      error = message;
      throw new Error(message);
    },
  };
  try {
    (plugin.generateBundle as unknown as GenerateBundle).call(context, {}, bundle);
  } catch {
    /* error captured above */
  }
  return error;
}

describe("findBundleBudgetViolations", () => {
  it("returns nothing when every tracked chunk is within budget", () => {
    const bundle = {
      "a.js": { type: "chunk" as const, fileName: "assets/MapV2Page-abc123.js", code: "x".repeat(1000) },
      "b.js": { type: "chunk" as const, fileName: "assets/threeKit-def456.js", code: "x".repeat(1000) },
    };
    expect(findBundleBudgetViolations(bundle)).toEqual([]);
  });

  it("flags a tracked chunk over its budget", () => {
    const oversized = CHUNK_SIZE_BUDGETS_BYTES.MapV2Page + 1;
    const bundle = {
      "a.js": { type: "chunk" as const, fileName: "assets/MapV2Page-abc123.js", code: "x".repeat(oversized) },
    };
    expect(findBundleBudgetViolations(bundle)).toEqual([
      `MapV2Page chunk is ${oversized.toLocaleString()} bytes minified, over its ${CHUNK_SIZE_BUDGETS_BYTES.MapV2Page.toLocaleString()}-byte budget`,
    ]);
  });

  it("ignores assets and chunks with no matching budget key", () => {
    const bundle = {
      "a.css": { type: "asset" as const, fileName: "assets/MapV2Page-abc123.css", source: "x".repeat(10_000_000) },
      "b.js": { type: "chunk" as const, fileName: "assets/index-abc123.js", code: "x".repeat(10_000_000) },
    };
    expect(findBundleBudgetViolations(bundle)).toEqual([]);
  });
});

describe("bundleSizeBudgetGuard", () => {
  it("fails the build when a tracked chunk is over budget", () => {
    const oversized = CHUNK_SIZE_BUDGETS_BYTES.threeKit + 1;
    const bundle = { "a.js": { type: "chunk", fileName: "assets/threeKit-abc123.js", code: "x".repeat(oversized) } };
    expect(runBudgetGuard(bundle)).toContain("threeKit chunk is");
  });

  it("passes a bundle within every tracked budget", () => {
    const bundle = { "a.js": { type: "chunk", fileName: "assets/threeKit-abc123.js", code: "small" } };
    expect(runBudgetGuard(bundle)).toBeNull();
  });
});

describe("liveBundleGuard", () => {
  const leakyBundle = {
    "index.js": { type: "chunk", fileName: "assets/index.js", code: "mock-password", modules: {} },
  };

  it("fails a live build that leaks mock data", () => {
    expect(runGuard("live", leakyBundle)).toContain('Live bundle leaks mock data:\n  assets/index.js contains mock credential "mock-password"');
  });

  it("passes a clean live build", () => {
    expect(runGuard("live", { "index.js": { type: "chunk", fileName: "assets/index.js", code: "", modules: {} } })).toBeNull();
  });

  it("skips the check for mock builds", () => {
    expect(runGuard("mock", leakyBundle)).toBeNull();
  });
});
