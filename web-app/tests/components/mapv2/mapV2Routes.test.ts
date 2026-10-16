import { describe, expect, it } from "vitest";
import { MAP_V2_JOB_PATTERN, MAP_V2_PATH, mapV2JobPath } from "../../../src/components/mapv2/mapV2Routes";

describe("mapV2Routes", () => {
  it("builds an encoded job path under /mapv2", () => {
    expect(MAP_V2_PATH).toBe("/mapv2");
    expect(MAP_V2_JOB_PATTERN).toBe("/mapv2/job/:orderId");
    expect(mapV2JobPath("A B/1")).toBe("/mapv2/job/A%20B%2F1");
  });
});
