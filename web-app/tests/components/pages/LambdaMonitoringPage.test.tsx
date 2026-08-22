import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LambdaMonitoringPage } from "../../../src/components/pages/LambdaMonitoringPage";
import { lambdaMetricsService } from "../../../src/services/lambdaMetricsService";
import type { LambdaHealth } from "../../../src/models/lambdaMetrics";

vi.mock("../../../src/services/lambdaMetricsService", () => ({
  lambdaMetricsService: { listLambdaHealth: vi.fn() },
}));

const mockedListLambdaHealth = vi.mocked(lambdaMetricsService.listLambdaHealth);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LambdaMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedListLambdaHealth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LambdaMonitoringPage", () => {
  it("shows a loading state, then the heading and a link back to Monitoring", () => {
    mockedListLambdaHealth.mockResolvedValue([]);
    renderPage();

    expect(screen.getByRole("heading", { name: "Lambda Health" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders one chart per lambda once data resolves", async () => {
    const lambdas: LambdaHealth[] = [
      { logicalName: "Poller", functionName: "Nyc311Poller-Test", points: [] },
      { logicalName: "OrderFanOut", functionName: "Nyc311OrderFanOut-Test", points: [] },
    ];
    mockedListLambdaHealth.mockResolvedValue(lambdas);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Poller" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OrderFanOut" })).toBeInTheDocument();
  });

  it("shows an empty-state message when no lambdas are configured", async () => {
    mockedListLambdaHealth.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No monitored Lambdas configured.")).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedListLambdaHealth.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load Lambda metrics: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedListLambdaHealth.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load Lambda metrics.");
  });
});
