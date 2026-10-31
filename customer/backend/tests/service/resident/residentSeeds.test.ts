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

  it("grants every resident the REQUESTS and FEATURE_REQUESTS buckets, with a preference for each tool and none for the website (docs/16 §5.1)", () => {
    for (const seed of parseSeeds(RESIDENT_SEEDS)) {
      expect(seed.action_buckets).toEqual(["REQUESTS", "FEATURE_REQUESTS"]);
      expect(seed.action_weights.BROWSE_WEBSITE).toBe(0);
      for (const tool of ["SEARCH_REQUESTS", "CREATE_FEATURE_REQUEST", "GET_FEATURE_REQUEST"] as const) expect(seed.action_weights[tool]).toBeGreaterThan(0);
    }
  });
});
