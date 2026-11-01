import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicApiHealth } from "../../../src/components/publicApi/PublicApiHealth";
import { publicApiMetricsService } from "../../../src/services/publicApiMetricsService";
import { MOCK_PUBLIC_API_METRICS } from "../../../src/test-data/publicApiMetrics";

vi.mock("../../../src/services/publicApiMetricsService", () => ({ publicApiMetricsService: { getMetrics: vi.fn() } }));
const mockedGetMetrics = vi.mocked(publicApiMetricsService.getMetrics);

function renderHealth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicApiHealth />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetMetrics.mockReset();
});

describe("PublicApiHealth", () => {
  it("shows loading, then the day's totals and one bar per hour", async () => {
    mockedGetMetrics.mockResolvedValue(MOCK_PUBLIC_API_METRICS);
    renderHealth();
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    expect(await screen.findByText("58")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
    expect(screen.getByText("310 ms")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Requests per hour" }).children).toHaveLength(24);
  });

  it("says so on a day with no requests, with dashes for latency", async () => {
    mockedGetMetrics.mockResolvedValue({
      ...MOCK_PUBLIC_API_METRICS,
      totals: { requests: 0, client_errors: 0, server_errors: 0, latency_p50_ms: null, latency_p99_ms: null },
      points: [],
    });
    renderHealth();
    expect(await screen.findByText("No requests in the last 24 hours.")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("shows an alert when the metrics fail to load", async () => {
    mockedGetMetrics.mockRejectedValue(new Error("HTTP 500"));
    renderHealth();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load public API metrics: HTTP 500");
  });
});
