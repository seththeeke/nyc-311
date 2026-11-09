import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

const TEST_FILE = /\.test\.tsx?$/;
/* A file touching module-level test state needs its own module graph. */
const NEEDS_ISOLATION = /\bvi\.(mock|doMock|spyOn|stubEnv|stubGlobal|resetModules)\(/;

/** Lists every test file under `dir`, relative to this config's folder. */
function listTestFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTestFiles(path);
    return TEST_FILE.test(entry.name) ? [path] : [];
  });
}

const testFiles = listTestFiles("tests");
const isolatedFiles = testFiles.filter((file) => NEEDS_ISOLATION.test(readFileSync(file, "utf8")));
const sharedFiles = testFiles.filter((file) => !isolatedFiles.includes(file));

export default defineConfig({
  test: {
    /*
     * happy-dom over jsdom, and the threads pool over forks: this suite is
     * many small RTL files whose cost is dominated by per-file DOM-env +
     * worker startup, not the assertions. web-app has no native deps, so
     * the threads pool is safe here.
     */
    environment: "happy-dom",
    pool: "threads",
    setupFiles: ["tests/setup.ts"],
    /*
     * Two projects (#188). Files that mock, spy on or stub anything keep
     * per-file isolation: a vi.mock leaks through a shared module cache
     * (#145). Every other file shares its worker's env and module graph
     * (isolate: false), skipping a fresh happy-dom env per file. Files
     * are sorted by reading them here, so a new test can't be misfiled.
     */
    projects: [
      { extends: true, test: { name: "isolated", include: isolatedFiles } },
      { extends: true, test: { name: "shared", include: sharedFiles, isolate: false } },
    ],
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
