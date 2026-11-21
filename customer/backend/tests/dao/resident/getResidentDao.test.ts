import { afterEach, describe, expect, it, vi } from "vitest";
import { getResidentDao } from "../../../dao/resident/getResidentDao";
import { ResidentDao } from "../../../dao/resident/residentDao";

describe("getResidentDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new ResidentDao on every call", () => {
    vi.stubEnv("RESIDENTS_TABLE_NAME", "Residents-Prod");
    const dao = getResidentDao();
    expect(dao).toBeInstanceOf(ResidentDao);
    expect(getResidentDao()).not.toBe(dao);
  });

  it("throws when RESIDENTS_TABLE_NAME is missing", () => {
    vi.stubEnv("RESIDENTS_TABLE_NAME", "");
    expect(() => getResidentDao()).toThrow("RESIDENTS_TABLE_NAME");
  });
});
