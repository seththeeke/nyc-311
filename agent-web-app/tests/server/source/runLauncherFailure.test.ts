import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawn: () => ({ pid: undefined, unref: () => {} }) }));

describe("launchRun when the process doesn't start", () => {
  it("throws rather than reporting a run that never began", async () => {
    const { launchRun } = await import("../../../server/source/runLauncher.ts");
    expect(() => launchRun("/clone", "a", { AGENT_MANUAL: "1", AGENT_LOG_ROOT: "/l" })).toThrow("Couldn't start the run for a");
  });
});
