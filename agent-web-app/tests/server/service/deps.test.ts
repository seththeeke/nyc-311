import { describe, expect, it } from "vitest";
import { resolveDeps } from "../../../server/service/deps.ts";
import { runCommand } from "../../../server/source/commandRunner.ts";
import { isPidAlive } from "../../../server/source/launchdLogRunSource.ts";
import { fixtureConfig } from "../fixtures.ts";

describe("resolveDeps", () => {
  it("defaults to the real machine", async () => {
    const deps = resolveDeps({ config: fixtureConfig() });
    expect(deps.run).toBe(runCommand);
    expect(deps.pidCheck).toBe(isPidAlive);
    expect(deps.now()).toBeInstanceOf(Date);
    expect(await deps.runSource.listRuns("gamma-agent", 1)).toHaveLength(1);
  });
});
