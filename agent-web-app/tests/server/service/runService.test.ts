import { describe, expect, it } from "vitest";
import { getRun, listRuns, readRunLog } from "../../../server/service/runService.ts";
import { fixtureConfig } from "../fixtures.ts";

const deps = { config: fixtureConfig(), pidCheck: () => false };

describe("runService", () => {
  it("lists, gets and tails runs through the run source", async () => {
    expect((await listRuns(deps, "beta-agent", 2)).map((run) => run.runId)).toEqual(["20261107T060005", "20261106T180005"]);
    const detail = await getRun(deps, "alpha-agent", "20261107T050004");
    expect(detail).toMatchObject({ status: "SUCCEEDED", report: expect.stringContaining("Held.") });
    expect((await readRunLog(deps, "gamma-agent", "20261107T070001", 0)).text).toContain("IDLE");
  });
});
