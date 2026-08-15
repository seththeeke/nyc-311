import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDistDirectory } from "../../web/ensureDistDirectory";

describe("ensureDistDirectory", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ensure-dist-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("creates the directory and a placeholder index.html when it doesn't exist", () => {
    const distDir = path.join(tmpRoot, "dist");

    ensureDistDirectory(distDir);

    expect(fs.existsSync(path.join(distDir, "index.html"))).toBe(true);
  });

  it("writes a placeholder when the directory exists but is empty", () => {
    const distDir = path.join(tmpRoot, "dist");
    fs.mkdirSync(distDir);

    ensureDistDirectory(distDir);

    expect(fs.existsSync(path.join(distDir, "index.html"))).toBe(true);
  });

  it("leaves an existing non-empty directory untouched", () => {
    const distDir = path.join(tmpRoot, "dist");
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, "index.html"), "real build output");

    ensureDistDirectory(distDir);

    expect(fs.readFileSync(path.join(distDir, "index.html"), "utf-8")).toBe("real build output");
  });
});
