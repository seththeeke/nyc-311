import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { Agent } from "../../shared/models/agent.ts";
import type { RunSummary } from "../../shared/models/run.ts";
import type { RunDetail } from "../../shared/models/runDetail.ts";
import type { ServerHealth } from "../../shared/models/serverHealth.ts";
import type { Worktree } from "../../shared/models/worktree.ts";
import { AppRoutes } from "../../web/routes/AppRoutes.tsx";

export function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    agent: "cto-agent", runId: "20261107T140004", startedAt: "2026-11-07T22:00:04.000Z", endedAt: "2026-11-07T22:01:52.000Z",
    status: "SUCCEEDED", mode: "RUN", model: null, exitCode: 0, durationSeconds: 108, chatPostId: "01M6W0G1GQGVFVSFJPTFA0VYEH",
    openPrsBefore: null, openPrsAfter: null, warnings: [], error: null, hasReport: true, manual: false, ...overrides,
  };
}

export function makeRunDetail(overrides: Partial<RunDetail> = {}): RunDetail {
  return { ...makeRun(overrides), report: "## Final Report\n\nAll **good**.", ...overrides };
}

export function makeAgent(overrides: Partial<Agent> = {}, name = "cto-agent"): Agent {
  return {
    config: {
      name, description: "Rex reviews PRs.", kind: "OPERATIONS", schedule: [{ day: null, time: "08:00", mode: null }, { day: "Mon", time: "21:30", mode: "DAILY" }],
      model: "sonnet", teamChatEnv: "PROD", branchPrefix: null, maxOpenPrs: null, flags: ["MEMORY"],
    },
    job: { installed: true, plistPath: "/p", scriptPath: "/clone/scripts/agent-scheduled-run.sh", plistSlots: ["08:00"], loaded: true, state: "not running", lastExitCode: 0, runs: 3 },
    health: [],
    nextFireAt: "2026-11-08T16:00:00.000Z",
    lastRun: makeRun({ agent: name }),
    currentRun: null,
    ...overrides,
  };
}

export function makeHealth(overrides: Partial<ServerHealth> = {}): ServerHealth {
  return { ok: true, logRoot: "/l", schedulerClone: "/c", primaryCheckout: "/p", launchAgentsDir: "/a", findings: [], ...overrides };
}

export function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return { checkout: "/c", path: "/c", branch: "main", head: "abc1234", dirtyCount: 0, agent: null, createdAt: null, isPrimary: true, ...overrides };
}

/** Stubs `fetch`, answering each `/api` path from `routes` (exact path incl. query), else a 404 `{ error }`. */
export function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    const path = url.startsWith("/api") ? url.slice("/api".length) : url;
    if (path in routes) return new Response(JSON.stringify(routes[path]), { status: 200 });
    return new Response(JSON.stringify({ error: `no route ${path}` }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function testClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Renders the whole app at `path` against stubbed fetch. */
export function renderAt(path: string) {
  return render(
    <QueryClientProvider client={testClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
