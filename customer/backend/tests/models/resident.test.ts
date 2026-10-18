import { describe, expect, it } from "vitest";
import { ResidentCurrentSchema, ResidentSeedSchema, ResidentVersionSchema, versionSortKey } from "../../models/resident";
import { RESIDENT_SEEDS } from "../../service/resident/residentSeeds";
import { buildResidentContent } from "../../service/resident/residentSyncService";
import { current, seed } from "../residentFixtures";

describe("resident models", () => {
  it("accepts every committed seed file", () => {
    for (const raw of RESIDENT_SEEDS) expect(ResidentSeedSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects a seed with an unknown field or an out-of-range dial", () => {
    expect(ResidentSeedSchema.safeParse({ ...seed, nickname: "Haw" }).success).toBe(false);
    expect(ResidentSeedSchema.safeParse({ ...seed, activity_level: 101 }).success).toBe(false);
    expect(ResidentSeedSchema.safeParse({ ...seed, schedule: "rate(1 hour)" }).success).toBe(false);
  });

  it("parses the CURRENT row and a version row", () => {
    expect(ResidentCurrentSchema.parse(current)).toEqual(current);
    const content = buildResidentContent(seed);
    const version = { ...content, version: 3, created_at: current.created_at };
    expect(ResidentVersionSchema.safeParse({ ...version, sk: "V#0003" }).success).toBe(true);
    expect(ResidentVersionSchema.safeParse({ ...version, sk: "CURRENT" }).success).toBe(false);
  });

  it("zero-pads version sort keys so they sort in order", () => {
    expect(versionSortKey(3)).toBe("V#0003");
    expect(versionSortKey(12345)).toBe("V#12345");
  });
});
