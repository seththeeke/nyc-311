import { describe, expect, it } from "vitest";
import { matchPath } from "react-router-dom";
import { IDEA_DETAIL_PATTERN, RESIDENTS_PATH, ideaDetailPath, residentFeedPath } from "../../../src/components/residents/residentRoutes";

describe("residentRoutes", () => {
  it("builds an Idea Detail path the router's pattern matches back", () => {
    const path = ideaDetailPath("hawthorn", "01K7IDEA0014");
    expect(path).toBe("/residents/hawthorn/ideas/01K7IDEA0014");
    expect(matchPath(IDEA_DETAIL_PATTERN, path)?.params).toEqual({ personaId: "hawthorn", ideaId: "01K7IDEA0014" });
  });

  it("links the feed focused on one resident, escaping ids", () => {
    expect(RESIDENTS_PATH).toBe("/residents");
    expect(residentFeedPath("a b")).toBe("/residents?persona=a%20b");
    expect(ideaDetailPath("a/b", "c")).toBe("/residents/a%2Fb/ideas/c");
  });
});
