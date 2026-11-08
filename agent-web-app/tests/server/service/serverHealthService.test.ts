import { describe, expect, it } from "vitest";
import { getServerHealth } from "../../../server/service/serverHealthService.ts";
import { fixtureConfig, stubRunner } from "../fixtures.ts";

describe("getServerHealth", () => {
  it("reports the paths and the scheduler clone's state", async () => {
    const config = fixtureConfig();
    const clean = stubRunner({ [`git -C ${config.schedulerClone} branch`]: { stdout: "main\n", code: 0 }, [`git -C ${config.schedulerClone} status`]: { stdout: "", code: 0 } });
    expect(await getServerHealth({ config, run: clean })).toMatchObject({ ok: true, schedulerClone: config.schedulerClone, findings: [] });
    const dirty = stubRunner({ [`git -C ${config.schedulerClone} status`]: { stdout: "?? x\n", code: 0 } });
    expect((await getServerHealth({ config, run: dirty })).findings.map((f) => f.code)).toEqual(["CLONE_NOT_MAIN", "CLONE_DIRTY"]);
  });
});
