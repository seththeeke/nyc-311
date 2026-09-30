import { describe, expect, it } from "vitest";
import type { Plugin } from "vite";
import { FORBIDDEN_LIVE_STRINGS, findLiveBundleLeaks, liveBundleGuard } from "../vite.config";
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
