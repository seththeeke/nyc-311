import { afterEach, describe, expect, it, vi } from "vitest";
import { getResidentIdeaDao } from "../../../dao/residentIdea/getResidentIdeaDao";
import { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";

describe("getResidentIdeaDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new ResidentIdeaDao on every call", () => {
    vi.stubEnv("RESIDENT_IDEAS_TABLE_NAME", "ResidentIdeas-Prod");
    vi.stubEnv("RESIDENTS_TABLE_NAME", "Residents-Prod");
    const dao = getResidentIdeaDao();
    expect(dao).toBeInstanceOf(ResidentIdeaDao);
    expect(getResidentIdeaDao()).not.toBe(dao);
  });

  it("throws when RESIDENT_IDEAS_TABLE_NAME is missing", () => {
    vi.stubEnv("RESIDENT_IDEAS_TABLE_NAME", "");
    vi.stubEnv("RESIDENTS_TABLE_NAME", "Residents-Prod");
    expect(() => getResidentIdeaDao()).toThrow("RESIDENT_IDEAS_TABLE_NAME");
  });

  it("throws when RESIDENTS_TABLE_NAME is missing", () => {
    vi.stubEnv("RESIDENT_IDEAS_TABLE_NAME", "ResidentIdeas-Prod");
    vi.stubEnv("RESIDENTS_TABLE_NAME", "");
    expect(() => getResidentIdeaDao()).toThrow("RESIDENTS_TABLE_NAME");
  });
});
