import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * `/v<n>/` marks the public API's published contract (`.claude/API.md`) and
 * nothing else (docs/17-executive-team.md §10.4). Internal route lists stay
 * unversioned; every public route carries the version.
 */
const WEB_API = join(__dirname, "../../../controller/web-api");
const VERSIONED = /^[A-Z]+ \/v\d+\//;
const PUBLIC_BUNDLE = "publicV1";

async function routeLists(): Promise<{ bundle: string; routes: string[] }[]> {
  const lists: { bundle: string; routes: string[] }[] = [];
  for (const bundle of readdirSync(WEB_API)) {
    const file = join(WEB_API, bundle, `${bundle}ApiRoutes.ts`);
    if (!existsSync(file)) continue;
    const exported: Record<string, unknown> = await import(file);
    const routes = Object.values(exported).filter(Array.isArray).flat().filter((key): key is string => typeof key === "string");
    lists.push({ bundle, routes });
  }
  return lists;
}

describe("route version prefixes", () => {
  it("finds the public bundle and at least one internal bundle", async () => {
    const bundles = (await routeLists()).map((list) => list.bundle);
    expect(bundles).toContain(PUBLIC_BUNDLE);
    expect(bundles.length).toBeGreaterThan(1);
  });

  it("keeps /v<n>/ out of every internal route list", async () => {
    const versioned = (await routeLists())
      .filter((list) => list.bundle !== PUBLIC_BUNDLE)
      .flatMap((list) => list.routes.filter((route) => VERSIONED.test(route)).map((route) => `${list.bundle}: ${route}`));
    expect(versioned).toEqual([]);
  });

  it("versions every public route", async () => {
    const publicList = (await routeLists()).find((list) => list.bundle === PUBLIC_BUNDLE);
    expect(publicList?.routes.length).toBeGreaterThan(0);
    expect(publicList?.routes.filter((route) => !VERSIONED.test(route))).toEqual([]);
  });
});
