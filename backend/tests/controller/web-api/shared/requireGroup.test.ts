import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireGroup } from "../../../../controller/web-api/shared/requireGroup";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireGroup", () => {
  it("permits a caller holding any allowed group", () => {
    expect(requireGroup({ "cognito:groups": "[BOROUGH_SIM_TEAM BOROUGH_SIM_OPERATIONS]" }, ["BOROUGH_SIM_OPERATIONS"], "GET /capacity")).toBe(true);
  });

  it("denies and logs a caller outside the allowed groups", () => {
    expect(requireGroup({ "cognito:groups": "[BOROUGH_SIM_TEAM]" }, ["ADMIN"], "GET /admin/whoami")).toBe(false);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("denies a caller with no groups claim", () => {
    expect(requireGroup({}, ["ADMIN"], "GET /admin/whoami")).toBe(false);
  });
});
