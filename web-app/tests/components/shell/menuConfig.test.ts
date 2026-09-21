import { describe, expect, it } from "vitest";
import { MENU, linkIsActive, sectionContainsPath, type MenuLinkEntry, type MenuSectionEntry } from "../../../src/components/shell/menuConfig";

const sections = MENU.filter((e): e is MenuSectionEntry => e.kind === "SECTION");
const monitoring = sections.find((s) => s.id === "MONITORING")!;
const admin = sections.find((s) => s.id === "ADMIN")!;
const map = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK")!;

describe("MENU", () => {
  it("has exactly the three primary entries in order: Map, System Monitoring, Admin", () => {
    expect(MENU.map((e) => e.label)).toEqual(["Map", "System Monitoring", "Admin"]);
  });

  it("lists the six monitoring items, with Test Coverage flagged external", () => {
    expect(monitoring.items.map((i) => i.label)).toEqual([
      "Ingestion",
      "Pipeline",
      "Lambda Health",
      "Test Coverage",
      "Integration Tests",
      "Data Modeling",
    ]);
    expect(monitoring.items.filter((i) => i.external).map((i) => i.label)).toEqual(["Test Coverage"]);
    expect(monitoring.requiresAuth).toBe(false);
  });

  it("lists the three admin items and requires auth", () => {
    expect(admin.items.map((i) => i.to)).toEqual(["/admin/capacity", "/admin/scheduling", "/admin/warehouse"]);
    expect(admin.requiresAuth).toBe(true);
  });
});

describe("sectionContainsPath", () => {
  it("matches the section's landing route and its item routes", () => {
    expect(sectionContainsPath(monitoring, "/monitoring")).toBe(true);
    expect(sectionContainsPath(monitoring, "/monitoring/pipeline")).toBe(true);
    expect(sectionContainsPath(monitoring, "/data")).toBe(true);
    expect(sectionContainsPath(admin, "/admin/capacity")).toBe(true);
  });

  it("does not match unrelated routes, similar prefixes, or external items", () => {
    expect(sectionContainsPath(monitoring, "/")).toBe(false);
    expect(sectionContainsPath(admin, "/administrator")).toBe(false);
    expect(sectionContainsPath(monitoring, "/coverage/index.html")).toBe(false);
    expect(sectionContainsPath(admin, "/login")).toBe(false);
  });
});

describe("linkIsActive", () => {
  it("highlights Map on / and on /about, nowhere else", () => {
    expect(linkIsActive(map, "/")).toBe(true);
    expect(linkIsActive(map, "/about")).toBe(true);
    expect(linkIsActive(map, "/data")).toBe(false);
  });
});
