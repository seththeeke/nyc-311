import { describe, expect, it } from "vitest";
import { MAP_JOB_PATTERN, MAP_PATH, mapJobPath } from "../../../src/components/map/mapRoutes";

describe("mapRoutes", () => {
  it("puts the city at / and builds an encoded job path under /job", () => {
    expect(MAP_PATH).toBe("/");
    expect(MAP_JOB_PATTERN).toBe("/job/:orderId");
    expect(mapJobPath("A B/1")).toBe("/job/A%20B%2F1");
  });
});
