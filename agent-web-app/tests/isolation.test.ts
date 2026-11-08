import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * CLAUDE.md §5.5: nothing in the other packages imports from agent-web-app/.
 * A plain path string is fine (cdk's pipeline trigger excludes
 * "agent-web-app/**"); an import, require or dynamic import is not. Its own
 * outbound imports are an ESLint error (local/stay-in-package).
 */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OTHER_PACKAGES = ["web-app", "backend", "cdk", "customer"];
const SKIP = new Set(["node_modules", "dist", "coverage", "cdk.out", ".tmp"]);
const SOURCE = /\.(ts|tsx|js|mjs|cjs)$/;

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (SKIP.has(entry)) return [];
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : SOURCE.test(entry) ? [full] : [];
  });
}

describe("package isolation", () => {
  it("no other package imports from agent-web-app", () => {
    const offenders = OTHER_PACKAGES.flatMap((pkg) => sourceFiles(path.join(REPO, pkg))).filter((file) =>
      /(\bfrom\s*|\brequire\(\s*|\bimport\(\s*)["'`][^"'`]*agent-web-app\b/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
