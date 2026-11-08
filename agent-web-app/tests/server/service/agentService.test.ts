import { describe, expect, it } from "vitest";
import { getAgent, listAgents } from "../../../server/service/agentService.ts";
import { NotFoundError } from "../../../server/models/errors.ts";
import { ALPHA_PLIST_JSON, BETA_PLIST_JSON, fixtureConfig, fixtureText, local, stubRunner } from "../fixtures.ts";

const deps = () => ({
  config: fixtureConfig(),
  run: stubRunner({
    "plutil -convert json -o - ": { stdout: "", code: 1 },
    "launchctl print gui/501/com.nyc311.agent.alpha-agent": { stdout: fixtureText("launchctlPrint.txt"), code: 0 },
  }),
  pidCheck: () => true,
  now: () => new Date(local(2026, 11, 7, 15, 0)),
});

function withPlists() {
  const base = deps();
  base.run = stubRunner({
    [`plutil -convert json -o - ${base.config.launchAgentsDir}/com.nyc311.agent.alpha-agent.plist`]: { stdout: ALPHA_PLIST_JSON, code: 0 },
    [`plutil -convert json -o - ${base.config.launchAgentsDir}/com.nyc311.agent.beta-agent.plist`]: { stdout: BETA_PLIST_JSON, code: 0 },
    "launchctl print gui/501/com.nyc311.agent.alpha-agent": { stdout: fixtureText("launchctlPrint.txt"), code: 0 },
  });
  return base;
}

describe("agentService", () => {
  it("lists every agent with config, job, runs and health", async () => {
    const agents = await listAgents(withPlists());
    expect(agents.map((agent) => agent.config.name)).toEqual(["alpha-agent", "beta-agent", "delta-agent", "gamma-agent"]);
    const [alpha, beta, delta, gamma] = agents;
    expect(delta).toMatchObject({ lastRun: null, currentRun: null });
    expect(alpha.config.description).toBe("Alpha, a fixture operating agent. Reads things and posts a summary.");
    expect(alpha.currentRun?.runId).toBe("20261107T140004");
    expect(alpha.lastRun?.runId).toBe("20261107T050004");
    expect(alpha.nextFireAt).toBe(local(2026, 11, 8, 5, 0));
    expect(alpha.health.map((f) => f.code)).toEqual(["RUN_WARNINGS"]);
    expect(beta.job.loaded).toBe(false);
    expect(beta.nextFireAt).toBeNull();
    expect(beta.health.map((f) => f.code)).toEqual(["WRONG_CHECKOUT", "LAUNCHD_ERROR", "NOT_LOADED", "SCHEDULE_DRIFT"]);
    expect(gamma.health.map((f) => f.code)).toEqual(["NOT_INSTALLED"]);
  });

  it("gets one agent, or throws NotFoundError", async () => {
    expect((await getAgent(deps(), "gamma-agent")).lastRun?.mode).toBe("IDLE");
    await expect(getAgent(deps(), "nobody")).rejects.toBeInstanceOf(NotFoundError);
  });
});
