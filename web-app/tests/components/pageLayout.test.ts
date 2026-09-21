import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_CONTENT_CLASSES } from "../../src/components/pageLayout";

const PAGES_DIR = join(__dirname, "../../src/components/pages");
/* LoginPage (narrow centered form) and HomePage (full-bleed map) are the two pages that aren't padded content pages. */
const EXEMPT = new Set(["LoginPage.tsx", "HomePage.tsx"]);
const CONTENT_PAGES = readdirSync(PAGES_DIR).filter((file) => file.endsWith(".tsx") && !EXEMPT.has(file));

describe("page content width", () => {
  it("fills the workspace with consistent padding", () => {
    expect(PAGE_CONTENT_CLASSES).toContain("w-full");
    expect(PAGE_CONTENT_CLASSES).not.toMatch(/max-w-/);
  });

  it.each(CONTENT_PAGES)("%s uses the shared wrapper, not its own max-width column", (file) => {
    const source = readFileSync(join(PAGES_DIR, file), "utf8");
    expect(source).toContain("PAGE_CONTENT_CLASSES");
    expect(source).not.toMatch(/mx-auto max-w-/);
  });
});
