import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { makeHealth, makeWorktree, renderAt, stubApi } from "../../fixtures.tsx";

describe("WorktreesPage", () => {
  it("lists worktrees, flagging changed files and detached heads", async () => {
    stubApi({
      "/health": makeHealth(),
      "/worktrees": [
        makeWorktree(),
        makeWorktree({ path: "/w/cpo-agent-1793843078-2802", branch: null, head: "60cadd5", agent: "cpo-agent", createdAt: "2026-11-04T17:44:38.000Z", dirtyCount: 1, isPrimary: false }),
        makeWorktree({ path: "/w/odd", branch: null, head: null, isPrimary: false }),
      ],
    });
    renderAt("/worktrees");
    expect(await screen.findByText("/w/cpo-agent-1793843078-2802")).toBeInTheDocument();
    expect(screen.getByText("(checkout)")).toBeInTheDocument();
    expect(screen.getByText("detached 60cadd5")).toBeInTheDocument();
    expect(screen.getByText("cpo-agent")).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("text-amber-300");
  });
});
