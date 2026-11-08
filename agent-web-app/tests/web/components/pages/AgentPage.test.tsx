import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { makeAgent, makeHealth, makeRun, renderAt, stubApi } from "../../fixtures.tsx";

describe("AgentPage", () => {
  it("shows config, launchd state, findings and runs", async () => {
    stubApi({
      "/health": makeHealth(),
      "/agents/cto-agent": makeAgent({ health: [{ severity: "ERROR", code: "LAUNCHD_ERROR", message: "Operation not permitted" }] }),
      "/agents/cto-agent/runs?limit=100": [
        makeRun(),
        makeRun({ runId: "20261107T110004", status: "FAILED", error: "'claude' not on PATH", model: "opus" }),
        makeRun({ runId: "20261107T080004", status: "ABORTED", mode: null, warnings: ["w1", "w2"] }),
      ],
    });
    renderAt("/agents/cto-agent");
    expect(await screen.findByRole("heading", { name: "cto-agent" })).toBeInTheDocument();
    expect(screen.getByText("Rex reviews PRs.")).toBeInTheDocument();
    expect(screen.getByText("08:00, Mon 21:30 DAILY")).toBeInTheDocument();
    expect(screen.getByText("loaded, not running · last exit 0")).toBeInTheDocument();
    expect(screen.getByText("Operation not permitted")).toBeInTheDocument();
    expect(await screen.findByText("'claude' not on PATH")).toBeInTheDocument();
    expect(screen.getByText("2 warning(s)")).toBeInTheDocument();
    expect(screen.getByText("RUN · opus", { exact: false })).toBeInTheDocument();
  });

  it("covers a paused, unconfigured agent with no runs", async () => {
    const base = makeAgent();
    stubApi({
      "/health": makeHealth(),
      "/agents/cto-agent": makeAgent({
        config: { ...base.config, description: null, schedule: [], model: null, teamChatEnv: null, flags: [] },
        job: { ...base.job, loaded: false, state: null, lastExitCode: null, scriptPath: null },
      }),
      "/agents/cto-agent/runs?limit=100": [],
    });
    renderAt("/agents/cto-agent");
    expect(await screen.findByText("installed, not loaded · last exit —")).toBeInTheDocument();
    expect(screen.getByText("agent default")).toBeInTheDocument();
    expect(screen.getByText("off")).toBeInTheDocument();
    expect(await screen.findByText("No runs yet.")).toBeInTheDocument();
  });

  it("shows a not-installed agent and a loaded one with an unknown state", async () => {
    const base = makeAgent();
    stubApi({
      "/health": makeHealth(),
      "/agents/a-agent": makeAgent({ job: { ...base.job, installed: false, loaded: false } }, "a-agent"),
      "/agents/a-agent/runs?limit=100": [],
      "/agents/b-agent": makeAgent({ job: { ...base.job, state: null } }, "b-agent"),
      "/agents/b-agent/runs?limit=100": [],
    });
    const { unmount } = renderAt("/agents/a-agent");
    expect(await screen.findByText("not installed")).toBeInTheDocument();
    unmount();
    renderAt("/agents/b-agent");
    expect(await screen.findByText("loaded, ? · last exit 0")).toBeInTheDocument();
  });
});
