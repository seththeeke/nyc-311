import { describe, expect, it } from "vitest";
import { newPickKey, newUlid } from "../../../service/idea/ulid";

describe("ulid", () => {
  it("is 26 Crockford characters that sort by time", () => {
    const zero = () => Buffer.alloc(16);
    const early = newUlid(new Date("2026-10-17T00:00:00.000Z"), zero);
    const late = newUlid(new Date("2026-10-17T00:00:00.001Z"), zero);
    expect(early).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(early < late).toBe(true);
    expect(newUlid(new Date())).toHaveLength(26);
  });

  it("makes random hex pick keys", () => {
    expect(newPickKey()).toMatch(/^[0-9a-f]{16}$/);
    expect(newPickKey(() => Buffer.from([255, 0, 0, 0, 0, 0, 0, 1]))).toBe("ff00000000000001");
  });
});
