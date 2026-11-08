import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../../../server/models/errors.ts";
import { startRun } from "../../../server/service/runLaunchService.ts";
import type { RunLauncher } from "../../../server/source/runLauncher.ts";
import { runRequestSchema } from "../../../shared/models/runRequest.ts";
import { fixtureConfig } from "../fixtures.ts";

function deps(running = false) {
  const launcher = vi.fn<RunLauncher>(() => 4242);
  return { launcher, deps: { config: fixtureConfig(), pidCheck: () => running, run: async () => ({ stdout: "", code: 1 }), launcher } };
}
const request = (body: object) => runRequestSchema.parse(body);

describe("startRun", () => {
  it("starts the scheduled prompt when no prompt is given", async () => {
    const { launcher, deps: d } = deps();
    expect(await startRun(d, "beta-agent", request({ prompt: "   " }))).toMatchObject({ agent: "beta-agent", pid: 4242 });
    expect(launcher).toHaveBeenCalledWith(d.config.schedulerClone, "beta-agent", { AGENT_MANUAL: "1", AGENT_LOG_ROOT: d.config.logRoot });
  });

  it("passes the prompt, how it's used, the slot mode and Test chat", async () => {
    const { launcher, deps: d } = deps();
    await startRun(d, "alpha-agent", request({ prompt: " Hello ", promptMode: "REPLACE", mode: "AUDIT", testChat: true }));
    expect(launcher.mock.calls[0][2]).toEqual({
      AGENT_MANUAL: "1", AGENT_LOG_ROOT: d.config.logRoot, AGENT_PROMPT: "Hello", AGENT_PROMPT_MODE: "replace", AGENT_MODE: "AUDIT", AGENT_CHAT_ENV: "TEST",
    });
    await startRun(d, "alpha-agent", request({ prompt: "Also this" }));
    expect(launcher.mock.calls[1][2]).toMatchObject({ AGENT_PROMPT: "Also this", AGENT_PROMPT_MODE: "append" });
  });

  it("refuses an agent that's already running, an unknown mode, or an unknown agent", async () => {
    await expect(startRun(deps(true).deps, "alpha-agent", request({}))).rejects.toBeInstanceOf(ConflictError);
    await expect(startRun(deps().deps, "beta-agent", request({ mode: "AUDIT" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(startRun(deps().deps, "nobody", request({}))).rejects.toBeInstanceOf(NotFoundError);
  });
});
