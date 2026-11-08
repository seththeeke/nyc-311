import { describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchRun } from "../../../server/source/runLauncher.ts";

describe("launchRun", () => {
  it("starts the clone's wrapper for the agent, detached, with the run's env", async () => {
    const clone = mkdtempSync(path.join(os.tmpdir(), "agent-launch-"));
    const out = path.join(clone, "out.txt");
    mkdirSync(path.join(clone, "scripts"));
    const script = path.join(clone, "scripts/agent-scheduled-run.sh");
    writeFileSync(script, `printf '%s|%s|%s' "$1" "$AGENT_MANUAL" "$AGENT_PROMPT" > ${JSON.stringify(out)}\n`);
    chmodSync(script, 0o755);
    const pid = launchRun(clone, "fake-agent", { AGENT_MANUAL: "1", AGENT_LOG_ROOT: clone, AGENT_PROMPT: "hi there" });
    expect(pid).toBeGreaterThan(0);
    for (let i = 0; i < 50 && !existsSync(out); i++) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(readFileSync(out, "utf8")).toBe("fake-agent|1|hi there");
    rmSync(clone, { recursive: true, force: true });
  });
});
