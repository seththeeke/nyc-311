import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { makeHealth, makeRunDetail, renderAt, stubApi } from "../../fixtures.tsx";

const path = "/agents/cto-agent/runs/20261107T140004";

describe("RunPage", () => {
  it("shows facts, the rendered report and the log", async () => {
    stubApi({
      "/health": makeHealth(),
      [`${path}`]: makeRunDetail({ openPrsBefore: "#158", openPrsAfter: "none", warnings: ["git pull --ff-only failed"], model: "opus" }),
      [`${path}/log?offset=0`]: { text: "[2026-11-07 14:00:04] === cto-agent scheduled run", offset: 0, nextOffset: 50 },
    });
    renderAt(path);
    expect(await screen.findByText("good")).toBeInTheDocument();
    expect(screen.getByText("01M6W0G1GQGVFVSFJPTFA0VYEH")).toBeInTheDocument();
    expect(screen.getByText("#158")).toBeInTheDocument();
    expect(screen.getByText("git pull --ff-only failed")).toBeInTheDocument();
    expect(screen.getByText("1m 48s")).toBeInTheDocument();
    expect(await screen.findByText(/=== cto-agent scheduled run/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Log" })).toBeInTheDocument();
  });

  it("marks a running run live and handles a missing report and empty log", async () => {
    stubApi({
      "/health": makeHealth(),
      [`${path}`]: makeRunDetail({ status: "RUNNING", report: null, exitCode: null, chatPostId: null, startedAt: new Date().toISOString() }),
      [`${path}/log?offset=0`]: { text: "", offset: 0, nextOffset: 0 },
    });
    renderAt(path);
    expect(await screen.findByText("No report for this run.")).toBeInTheDocument();
    expect(screen.getByText(/so far$/)).toBeInTheDocument();
    expect(await screen.findByText("(empty)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Log (live)" })).toBeInTheDocument();
  });
});
