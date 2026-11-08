import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { makeAgent, makeHealth, makeRun, renderAt, stubApi } from "../../fixtures.tsx";

describe("DashboardPage", () => {
  it("shows every agent, attention-worthy ones first, with machine findings", async () => {
    stubApi({
      "/health": makeHealth({ findings: [{ severity: "WARN", code: "CLONE_DIRTY", message: "The scheduler clone has 2 changed file(s)." }] }),
      "/agents": [
        makeAgent({}, "zeta-agent"),
        makeAgent({ job: { ...makeAgent().job, loaded: false } }, "paused-agent"),
        makeAgent({ health: [{ severity: "WARN", code: "RUN_WARNINGS", message: "warned" }] }, "warn-agent"),
        makeAgent({ health: [{ severity: "ERROR", code: "WRONG_CHECKOUT", message: "wrong" }] }, "error-agent"),
        makeAgent({ currentRun: makeRun({ status: "RUNNING", startedAt: new Date().toISOString() }) }, "busy-agent"),
        makeAgent({ lastRun: null, job: { ...makeAgent().job, installed: false, loaded: false }, config: { ...makeAgent({}, "new-agent").config, schedule: [] } }, "new-agent"),
      ],
    });
    renderAt("/");
    expect(await screen.findByText("6 agents · 1 running now")).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names.slice(1)).toEqual(["busy-agent", "error-agent", "warn-agent", "new-agent", "paused-agent", "zeta-agent"]);
    expect(screen.getByText(/2 changed file/)).toBeInTheDocument();
    const busy = screen.getByRole("heading", { name: "busy-agent" }).closest("article") as HTMLElement;
    expect(within(busy).getByText("Running", { selector: "dt" })).toBeInTheDocument();
    const fresh = screen.getByRole("heading", { name: "new-agent" }).closest("article") as HTMLElement;
    expect(within(fresh).getByText("no runs yet")).toBeInTheDocument();
    expect(within(fresh).getByText("Not installed")).toBeInTheDocument();
    expect(within(fresh).getByText("not scheduled")).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: "paused-agent" }).closest("article") as HTMLElement).getByText("Paused")).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: "zeta-agent" }).closest("article") as HTMLElement).getByText("Healthy")).toBeInTheDocument();
  });

  it("shows an error when the API fails", async () => {
    stubApi({ "/health": makeHealth() });
    renderAt("/");
    expect(await screen.findByRole("alert")).toHaveTextContent("no route /agents");
  });
});
