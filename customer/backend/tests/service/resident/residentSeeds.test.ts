import { readdirSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { RESIDENT_SEEDS } from "../../../service/resident/residentSeeds";
import { parseSeeds } from "../../../service/resident/residentSyncService";

describe("RESIDENT_SEEDS", () => {
  it("includes every seed file in residents/, each valid, named for its own persona_id", () => {
    const files = readdirSync(path.join(__dirname, "..", "..", "..", "residents")).filter((file) => file.endsWith(".json"));
    const seeds = parseSeeds(RESIDENT_SEEDS);
    expect(seeds.map((seed) => `${seed.persona_id}.json`).sort()).toEqual(files.sort());
  });

  it("grants no tool bucket yet: residents generate ideas but take no actions", () => {
    for (const seed of parseSeeds(RESIDENT_SEEDS)) expect(seed.action_buckets).toEqual([]);
  });
});
