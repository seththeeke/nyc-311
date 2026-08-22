import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IngestionMonitoringPage } from "../../../src/components/pages/IngestionMonitoringPage";
import { pollerMetricsService } from "../../../src/services/pollerMetricsService";
import type { PollerMetrics, PollerMetricsResponse } from "../../../src/models/pollerMetrics";

vi.mock("../../../src/services/pollerMetricsService", () => ({
  pollerMetricsService: { listPollerMetrics: vi.fn() },
}));

const mockedListPollerMetrics = vi.mocked(pollerMetricsService.listPollerMetrics);

const emptyResponse: PollerMetricsResponse = { metrics: [], cursor: null };

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <IngestionMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedListPollerMetrics.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IngestionMonitoringPage", () => {
  it("shows a loading state, then the heading and a link back to Monitoring", async () => {
    mockedListPollerMetrics.mockResolvedValue(emptyResponse);
    renderPage();

    expect(screen.getByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the metrics table once data resolves", async () => {
    const metrics: PollerMetrics[] = [
      {
        ran_at: "2026-08-15T15:12:43.894Z",
        success: true,
        records_ingested: 2000,
        duplicates_skipped: 0,
        records_rejected: 0,
        error_message: null,
      },
    ];
    mockedListPollerMetrics.mockResolvedValue({ metrics, cursor: null });
    renderPage();

    expect(await screen.findByText("2000")).toBeInTheDocument();
  });

  it("shows an empty-state message when no runs have been recorded yet", async () => {
    mockedListPollerMetrics.mockResolvedValue(emptyResponse);
    renderPage();

    expect(await screen.findByText("No poller runs recorded yet.")).toBeInTheDocument();
  });

  it("renders the cursor section even when there are no poller runs yet", async () => {
    mockedListPollerMetrics.mockResolvedValue(emptyResponse);
    renderPage();

    expect(await screen.findByText("No ingestion cursor yet — the poller hasn't completed a run.")).toBeInTheDocument();
  });

  it("renders the cursor's status once data resolves", async () => {
    mockedListPollerMetrics.mockResolvedValue({
      metrics: [],
      cursor: { last_watermark: "2026-08-15T18:00:00", resume_offset: null, lag_hours: 72, is_stale: false },
    });
    renderPage();

    expect(await screen.findByText("Healthy")).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedListPollerMetrics.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load ingestion metrics: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedListPollerMetrics.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load ingestion metrics.");
  });
});
