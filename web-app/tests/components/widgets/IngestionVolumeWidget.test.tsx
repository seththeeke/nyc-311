import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { IngestionVolumeWidget } from "../../../src/components/widgets/IngestionVolumeWidget";
import { IngestionMonitoringPage } from "../../../src/components/pages/IngestionMonitoringPage";
import { pollerMetricsService } from "../../../src/services/pollerMetricsService";
import type { PollerMetricsResponse } from "../../../src/models/pollerMetrics";

vi.mock("../../../src/services/pollerMetricsService", () => ({
  pollerMetricsService: { listPollerMetrics: vi.fn() },
}));
const mockedList = vi.mocked(pollerMetricsService.listPollerMetrics);

const RESPONSE: PollerMetricsResponse = {
  cursor: { last_watermark: "2026-08-15T18:00:00", resume_offset: null, lag_hours: 72, is_stale: false },
  metrics: [
    { ran_at: "2026-08-15T18:00:00.000Z", success: true, records_ingested: 42, duplicates_skipped: 5, records_rejected: 0, error_message: null },
  ],
};

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
}

afterEach(() => mockedList.mockReset());

describe("IngestionVolumeWidget", () => {
  it("shows a loading state, then the compact chart", async () => {
    mockedList.mockResolvedValue(RESPONSE);
    render(
      <QueryClientProvider client={client()}>
        <IngestionVolumeWidget />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("img")).toHaveAccessibleName(/42 ingested/);
  });

  it("shows an error message when the metrics can't load, and an empty state for no runs", async () => {
    mockedList.mockRejectedValueOnce(new Error("HTTP 500"));
    const { unmount } = render(
      <QueryClientProvider client={client()}>
        <IngestionVolumeWidget />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Ingestion metrics unavailable.");
    unmount();

    mockedList.mockResolvedValue({ cursor: RESPONSE.cursor, metrics: [] });
    render(
      <QueryClientProvider client={client()}>
        <IngestionVolumeWidget />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("No poller runs recorded yet.")).toBeInTheDocument();
  });

  it("shares one backend call with the Ingestion page (same query key, same cache)", async () => {
    mockedList.mockResolvedValue(RESPONSE);
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <IngestionVolumeWidget />
          <IngestionMonitoringPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole("img").length).toBeGreaterThan(0));
    await screen.findByText("Ingestion volume");
    expect(mockedList).toHaveBeenCalledTimes(1);
  });
});
