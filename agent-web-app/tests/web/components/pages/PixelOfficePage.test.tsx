import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { makeAgent, makeHealth, makeRun, renderAt, stubApi } from "../../fixtures.tsx";

describe("PixelOfficePage", () => {
  it("gives every agent a room in roster order, with a nameplate that links to the agent", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const base = makeAgent();
    stubApi({
      "/health": makeHealth(),
      "/agents": [
        makeAgent({}, "zz-new-agent"),
        makeAgent({ job: { ...base.job, loaded: false } }, "aws-cost-agent"),
        makeAgent({ health: [{ severity: "ERROR", code: "X", message: "x" }] }, "cto-agent"),
        makeAgent({ currentRun: makeRun({ status: "RUNNING" }) }, "devx-agent"),
        makeAgent({}, "aa-new-agent"),
        makeAgent({}, "chief-of-staff-agent"),
      ],
    });
    renderAt("/office");
    expect(await screen.findByRole("heading", { name: /The Pixel Office/ })).toBeInTheDocument();
    const rooms = (await screen.findAllByRole("img")).map((img) => img.getAttribute("aria-label"));
    expect(rooms).toEqual([
      "The 1950s Office: Penny is waiting for the next run",
      "Hangar Bay 3: Rex needs attention",
      "The Workshop: Pip is at work on a run",
      "Under the Toll Bridge: Grimble is asleep (not scheduled)",
      "The Server Closet: aa-new-agent is waiting for the next run",
      "The Server Closet: zz-new-agent is waiting for the next run",
    ]);
    expect(screen.getByText("on shift")).toBeInTheDocument();
    expect(screen.getByText("off duty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pip Sprocketwhistle/ })).toHaveAttribute("href", "/agents/devx-agent");
    expect(screen.getByRole("link", { name: "Pixel Office" })).toHaveAttribute("aria-current", "page");
  });
});
