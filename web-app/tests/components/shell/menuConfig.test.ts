import { describe, expect, it } from "vitest";
import {
  MENU,
  linkIsActive,
  pathIsInAnySection,
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
  it("has exactly seven primary entries in order: Map, Residents, Contacts, Meet the Team, Team Chat, System Monitoring, Admin", () => {
    expect(MENU.map((e) => e.label)).toEqual(["Map", "Residents", "Contacts", "Meet the Team", "Team Chat", "System Monitoring", "Admin"]);
  });

  it("flags Contacts, Meet the Team and Team Chat (T1); Map and Residents are unflagged", () => {
    const flagged = MENU.filter((e) => e.kind === "LINK" && e.featureFlag);
    expect(flagged.map((e) => e.id)).toEqual(["CONTACTS", "TEAM", "TEAM_CHAT"]);
    expect(flagged[0]).toMatchObject({ to: "/contacts", featureFlag: { key: "CONTACTS_PAGE", showOn: ["T1"] } });
    expect(flagged[1]).toMatchObject({ to: "/team", featureFlag: { key: "MEET_THE_TEAM", showOn: ["T1"] } });
    expect(map).toMatchObject({ id: "MAP", to: "/" });
    expect(map.featureFlag).toBeUndefined();
  });

  it("lists the eight monitoring items, with Test Coverage flagged external", () => {
    expect(monitoring.items.map((i) => i.label)).toEqual([
      "311 Request Metrics",
      "Pipeline",
      "Lambda Health",
      "Public API",
      "Code Quality",
      "Test Coverage",
      "Integration Tests",
      "Data Modeling",
    ]);
    expect(monitoring.items.filter((i) => i.external).map((i) => i.label)).toEqual(["Test Coverage"]);
    expect(monitoring.requiresAuth).toBe(false);
  });

  it("lists the three admin items and requires auth", () => {
    expect(admin.items.map((i) => i.to)).toEqual([
      "/admin/capacity",
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
  it("highlights Map on /, /about and a job dive-in, nowhere else", () => {
    expect(linkIsActive(map, "/")).toBe(true);
    expect(linkIsActive(map, "/about")).toBe(true);
    expect(linkIsActive(map, "/job/01MOCKORDER001")).toBe(true);
    expect(linkIsActive(map, "/jobs")).toBe(false);
    expect(linkIsActive(map, "/data")).toBe(false);
  });

  it("keeps a non-root link active on its sub-pages, but not on a look-alike path", () => {
    const residents = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "RESIDENTS")!;
    expect(linkIsActive(residents, "/residents")).toBe(true);
    expect(linkIsActive(residents, "/residents/hawthorn/ideas/01K7IDEA0014")).toBe(true);
    expect(linkIsActive(residents, "/residentsx")).toBe(false);
  });

  it("hands a sub-page to the deeper link that owns it: Team Chat, not Meet the Team, on /team/chat", () => {
    const team = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "TEAM")!;
    const chat = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "TEAM_CHAT")!;
    expect(linkIsActive(team, "/team/chat")).toBe(false);
    expect(linkIsActive(chat, "/team/chat")).toBe(true);
    expect(linkIsActive(team, "/team/other")).toBe(true);
  });

  it("hands a sub-page to the deeper link that owns it: Team Chat, not Meet the Team, on /team/chat", () => {
    const team = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "TEAM")!;
    const chat = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "TEAM_CHAT")!;
    expect(linkIsActive(team, "/team/chat")).toBe(false);
    expect(linkIsActive(chat, "/team/chat")).toBe(true);
    expect(linkIsActive(team, "/team/other")).toBe(true);
  });
});

describe("resolveFlaggedLink", () => {
  const team = MENU.find((e): e is MenuLinkEntry => e.kind === "LINK" && e.id === "TEAM")!;

  it("passes an unflagged link through untouched", () => {
    expect(resolveFlaggedLink(map, "T2")).toBe(map);
    expect(resolveFlaggedLink(map, undefined)).toBe(map);
  });

  it("show-on links appear only on their treatments — loading, missing and other treatments hide them", () => {
    expect(resolveFlaggedLink(team, undefined)).toBeNull();
    expect(resolveFlaggedLink(team, null)).toBeNull();
    expect(resolveFlaggedLink(team, "C")).toBeNull();
    expect(resolveFlaggedLink(team, "T1")).toBe(team);
  });
});
