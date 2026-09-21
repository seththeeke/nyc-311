import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PipelineMonitoringPage } from "../../../src/components/pages/PipelineMonitoringPage";
import { pipelineStatusService } from "../../../src/services/pipelineStatusService";
import type { PipelineStatusResponse } from "../../../src/models/pipelineStatus";

vi.mock("../../../src/services/pipelineStatusService", () => ({
  pipelineStatusService: { getPipelineStatus: vi.fn() },
}));

const mockedGetPipelineStatus = vi.mocked(pipelineStatusService.getPipelineStatus);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PipelineMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetPipelineStatus.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PipelineMonitoringPage", () => {
  it("shows a loading state, then the heading, a link back to Monitoring, and a link to the GitHub repo", () => {
    mockedGetPipelineStatus.mockResolvedValue({ pipelineName: "Nyc311Pipeline", stages: [], executions: [] });
    renderPage();

    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    const githubLink = screen.getByRole("link", { name: /view on github/i });
    expect(githubLink).toHaveAttribute("href", "https://github.com/seththeeke/nyc-311");
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("fills the workspace with the shared page wrapper, not a per-page max-width column", () => {
    mockedGetPipelineStatus.mockResolvedValue({ pipelineName: "Nyc311Pipeline", stages: [], executions: [] });
    const { container } = renderPage();

    expect(container.querySelector("main")).toHaveClass("w-full", "px-6", "py-10");
    expect(container.querySelector("main")?.className).not.toMatch(/max-w-/);
  });

  it("renders stages (with its embedded at-a-glance summary) and execution history once data resolves", async () => {
    const status: PipelineStatusResponse = {
      pipelineName: "Nyc311Pipeline",
      stages: [{ stageName: "Build", actions: [{ actionName: "Synth", status: "Succeeded", lastStatusChange: null, summary: null }] }],
      executions: [
        { executionId: "exec-1", status: "Succeeded", startTime: "2026-08-16T12:00:00.000Z", lastUpdateTime: "2026-08-16T12:04:00.000Z", commitId: "abc", commitMessage: "fix: thing", buildDurationSeconds: 240 },
      ],
    };
    mockedGetPipelineStatus.mockResolvedValue(status);
    renderPage();

    expect(await screen.findByText("Build")).toBeInTheDocument();
    /* The embedded at-a-glance pill's sr-only text, proving it renders on this page. */
    expect(screen.getByText(/Build: Succeeded/)).toBeInTheDocument();
    expect(screen.getByText("Build duration")).toBeInTheDocument();
    /* Appears twice: the execution history row and the build-duration chart's hover tooltip. */
    expect(screen.getAllByText("fix: thing").length).toBeGreaterThan(0);
  });

  it("shows an empty-state message when the pipeline has no stages yet", async () => {
    mockedGetPipelineStatus.mockResolvedValue({ pipelineName: "Nyc311Pipeline", stages: [], executions: [] });
    renderPage();

    expect(await screen.findByText("No pipeline state available yet.")).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedGetPipelineStatus.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load pipeline status: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedGetPipelineStatus.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load pipeline status.");
  });
});
