import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, matchPath } from "react-router-dom";
import type { ReactElement } from "react";
import { PAGES, type PageRoute } from "../../src/routes/pageTable";
import { MENU, type MenuSectionEntry } from "../../src/components/shell/menuConfig";
import { MonitoringPage } from "../../src/components/pages/MonitoringPage";
import { AdminPage } from "../../src/components/pages/AdminPage";
import { authResult } from "../testUtils/authFixtures";

vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => authResult({}) }));

/* The page whose route pattern matches `path`, or undefined (a dead link). */
function pageFor(path: string): PageRoute | undefined {
  return PAGES.find((page) => matchPath(page.path, path) !== null);
}

function section(id: MenuSectionEntry["id"]): MenuSectionEntry {
  const entry = MENU.find((e): e is MenuSectionEntry => e.kind === "SECTION" && e.id === id);
  if (!entry) throw new Error(`no ${id} section`);
  return entry;
}

/* The in-app tile hrefs on a tile page; external tiles open a new tab and aren't SPA routes. */
function internalTileHrefs(page: ReactElement): string[] {
  const { container, unmount } = render(<MemoryRouter>{page}</MemoryRouter>);
  const hrefs = Array.from(container.querySelectorAll("a:not([target])")).map((a) => a.getAttribute("href") ?? "");
  unmount();
  return hrefs;
}

/*
 * #203: page paths, tiers and flags are declared in the page table, the menu
 * and the tile pages. These checks fail the build when the copies drift: a
 * dead menu link or tile, a menu flag the route doesn't enforce, or an admin
 * menu item on a public route.
 */
describe("pageTable", () => {
  it("lists each path once", () => {
    const paths = PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("routes every menu section base path and non-external leaf to a page", () => {
    const targets = MENU.flatMap((entry) =>
      entry.kind === "SECTION" ? [entry.basePath, ...entry.items.filter((i) => !i.external).map((i) => i.to)] : []
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((to) => !pageFor(to))).toEqual([]);
  });

  it("gives every flagged menu link the same flag as its route", () => {
    for (const entry of MENU) {
      if (entry.kind !== "LINK" || !entry.featureFlag) continue;
      const page = pageFor(entry.to);
      expect(page?.flag, entry.id).toEqual({ key: entry.featureFlag.key, onTreatments: entry.featureFlag.showOn });
    }
  });

  it("puts every route behind a flag that the menu shows behind the same flag", () => {
    for (const page of PAGES.filter((p) => p.flag)) {
      const link = MENU.find((entry) => entry.kind === "LINK" && entry.to === page.path);
      if (link?.kind !== "LINK") continue;
      expect(link.featureFlag?.key, page.path).toBe(page.flag?.key);
    }
  });

  it("keeps the Admin section's pages admin-only and the Monitoring section's pages public", () => {
    const admin = section("ADMIN");
    const monitoring = section("MONITORING");
    expect(admin.requiresAuth).toBe(true);
    for (const to of [admin.basePath, ...admin.items.map((i) => i.to)]) expect(pageFor(to)?.tier, to).toBe("ADMIN");
    for (const to of [monitoring.basePath, ...monitoring.items.filter((i) => !i.external).map((i) => i.to)]) {
      expect(pageFor(to)?.tier, to).toBe("PUBLIC");
    }
  });

  it("routes every Monitoring tile to a public page", () => {
    const hrefs = internalTileHrefs(<MonitoringPage />);
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((to) => pageFor(to)?.tier !== "PUBLIC")).toEqual([]);
  });

  it("routes every Admin tile to an admin page", () => {
    const hrefs = internalTileHrefs(<AdminPage />);
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((to) => pageFor(to)?.tier !== "ADMIN")).toEqual([]);
  });

  it("reports a path no page matches as a dead link", () => {
    expect(pageFor("/monitoring/no-such-page")).toBeUndefined();
    expect(pageFor("/residents/hawthorn/ideas/01IDEA")?.path).toBe("/residents/:personaId/ideas/:ideaId");
  });
});
