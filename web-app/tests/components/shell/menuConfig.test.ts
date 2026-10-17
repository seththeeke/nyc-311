import { describe, expect, it } from "vitest";
import {
  MENU,
  linkIsActive,
  pathIsInAnySection,
  pathStartsSecondaryCollapsed,
  resolveFlaggedLink,
  sectionContainsPath,
  type MenuLinkEntry,
  type MenuSectionEntry,
} from "../../../src/components/shell/menuConfig";

const sections = MENU.filter((e): e is MenuSectionEntry => e.kind === "SECTION");
const monitoring = sections.find((s) => s.id === "MONITORING")!;
const admin = sections.find((s) => s.id === "ADMIN")!;
const map = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK")!;

describe("MENU", () => {
  it("has exactly five primary entries in order: Map, Mapv2, Residents, System Monitoring, Admin", () => {
    expect(MENU.map((e) => e.label)).toEqual(["Map", "Mapv2", "Residents", "System Monitoring", "Admin"]);
  });

  it("flags the classic Map (hidden on MAP_V2 = T2), Mapv2 (T1/T2) and Residents (CUSTOMERS_TAB = T1)", () => {
    const flagged = MENU.filter((e) => e.kind === "LINK" && e.featureFlag);
    expect(flagged.map((e) => e.id)).toEqual(["MAP", "MAP_V2", "RESIDENTS"]);
    expect(flagged[0]).toMatchObject({ to: "/", featureFlag: { key: "MAP_V2", hideOn: ["T2"] } });
    expect(flagged[1]).toMatchObject({ to: "/mapv2", featureFlag: { key: "MAP_V2", showOn: ["T1", "T2"], labelOn: { T2: "Map" } } });
    expect(flagged[2]).toMatchObject({ to: "/residents", featureFlag: { key: "CUSTOMERS_TAB", showOn: ["T1"] } });
  });

  it("lists the six monitoring items, with Test Coverage flagged external", () => {
    expect(monitoring.items.map((i) => i.label)).toEqual([
      "311 Request Metrics",
      "Pipeline",
      "Lambda Health",
      "Test Coverage",
      "Integration Tests",
      "Data Modeling",
    ]);
    expect(monitoring.items.filter((i) => i.external).map((i) => i.label)).toEqual(["Test Coverage"]);
    expect(monitoring.requiresAuth).toBe(false);
  });

  it("lists the four admin items and requires auth", () => {
    expect(admin.items.map((i) => i.to)).toEqual([
      "/admin/capacity",
      "/admin/scheduling",
      "/admin/warehouse",
      "/admin/feature-flags",
    ]);
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

describe("pathIsInAnySection", () => {
  it("is true on monitoring and admin routes, false on the map and other pages", () => {
    expect(pathIsInAnySection("/monitoring/ingestion")).toBe(true);
    expect(pathIsInAnySection("/data")).toBe(true);
    expect(pathIsInAnySection("/admin")).toBe(true);
    expect(pathIsInAnySection("/")).toBe(false);
    expect(pathIsInAnySection("/about")).toBe(false);
    expect(pathIsInAnySection("/login")).toBe(false);
  });
});

describe("linkIsActive", () => {
  it("highlights Map on / and on /about, nowhere else", () => {
    expect(linkIsActive(map, "/")).toBe(true);
    expect(linkIsActive(map, "/about")).toBe(true);
    expect(linkIsActive(map, "/data")).toBe(false);
  });

  it("keeps a non-root link active on its sub-pages, but not on a look-alike path", () => {
    const residents = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "RESIDENTS")!;
    expect(linkIsActive(residents, "/residents")).toBe(true);
    expect(linkIsActive(residents, "/residents/hawthorn/ideas/01K7IDEA0014")).toBe(true);
    expect(linkIsActive(residents, "/residentsx")).toBe(false);
  });
});

describe("pathStartsSecondaryCollapsed", () => {
  it("collapses the secondary panel on monitoring/admin and every Mapv2 route", () => {
    expect(pathStartsSecondaryCollapsed("/monitoring/pipeline")).toBe(true);
    expect(pathStartsSecondaryCollapsed("/mapv2")).toBe(true);
    expect(pathStartsSecondaryCollapsed("/mapv2/job/01MOCKORDER001")).toBe(true);
  });

  it("keeps it open on the classic map and look-alike paths", () => {
    expect(pathStartsSecondaryCollapsed("/")).toBe(false);
    expect(pathStartsSecondaryCollapsed("/residents")).toBe(false);
    expect(pathStartsSecondaryCollapsed("/mapv2x")).toBe(false);
  });
});

describe("resolveFlaggedLink", () => {
  const link = (id: string) => MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === id)!;
  const classic = link("MAP");
  const mapV2 = link("MAP_V2");

  it("passes an unflagged link through untouched", () => {
    const plain: MenuLinkEntry = { ...classic, featureFlag: undefined };
    expect(resolveFlaggedLink(plain, "T2")).toBe(plain);
  });

  it("show-on links appear only on their treatments — loading, missing and other treatments hide them", () => {
    expect(resolveFlaggedLink(mapV2, undefined)).toBeNull();
    expect(resolveFlaggedLink(mapV2, null)).toBeNull();
    expect(resolveFlaggedLink(mapV2, "C")).toBeNull();
    expect(resolveFlaggedLink(mapV2, "T1")).toMatchObject({ label: "Mapv2", alsoActiveOn: [] });
  });

  it("relabels and widens the active paths per treatment", () => {
    expect(resolveFlaggedLink(mapV2, "T2")).toMatchObject({ label: "Map", to: "/mapv2", alsoActiveOn: ["/about"] });
  });

  it("hide-on links stay up while loading, missing or on other treatments, and go only on theirs", () => {
    expect(resolveFlaggedLink(classic, undefined)).toBe(classic);
    expect(resolveFlaggedLink(classic, null)).toBe(classic);
    expect(resolveFlaggedLink(classic, "T1")).toMatchObject({ label: "Map", alsoActiveOn: ["/about"] });
    expect(resolveFlaggedLink(classic, "T2")).toBeNull();
  });

  it("a rule with neither showOn nor hideOn never hides", () => {
    expect(resolveFlaggedLink({ ...classic, featureFlag: { key: "X" } }, "ANY")).not.toBeNull();
  });
});
