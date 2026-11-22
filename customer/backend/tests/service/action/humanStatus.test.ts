import { describe, expect, it } from "vitest";
import { humanStatus } from "../../../service/action/humanStatus";

describe("humanStatus", () => {
  it("lower-cases a status and turns every underscore into a space", () => {
    expect(humanStatus("NOT_SERVICED")).toBe("not serviced");
    expect(humanStatus("UNDER_REVIEW")).toBe("under review");
    expect(humanStatus("CLOSED")).toBe("closed");
  });
});
