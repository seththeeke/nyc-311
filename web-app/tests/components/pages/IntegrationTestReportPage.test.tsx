import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntegrationTestReportPage } from "../../../src/components/pages/IntegrationTestReportPage";
import { integrationTestReportService } from "../../../src/services/integrationTestReportService";
import type { IntegrationTestReport } from "../../../src/models/integrationTestReport";

vi.mock("../../../src/services/integrationTestReportService", () => ({
  integrationTestReportService: { getReport: vi.fn() },
}));

const mockedGetReport = vi.mocked(integrationTestReportService.getReport);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <IntegrationTestReportPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetReport.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IntegrationTestReportPage", () => {
  it("shows a loading state, then the heading and a link back to Monitoring", () => {
    mockedGetReport.mockResolvedValue({ target: "test", ranAt: "2026-08-24T12:00:00.000Z", routes: {} });
    renderPage();

    expect(screen.getByRole("heading", { name: "Integration Tests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders a row per route with its status code once data resolves", async () => {
    const report: IntegrationTestReport = {
      target: "test",
      ranAt: "2026-08-24T12:00:00.000Z",
      routes: {
        "/orders": { hit: true, statusCode: 200, ok: true },
        "/lambda-metrics": { hit: false, statusCode: null, ok: false },
      },
    };
    mockedGetReport.mockResolvedValue(report);
    renderPage();

    expect(await screen.findByText("/orders")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("/lambda-metrics")).toBeInTheDocument();
    expect(screen.getByText("Not hit")).toBeInTheDocument();
  });

  it("renders a failing route's status code with the error styling", async () => {
    const report: IntegrationTestReport = {
      target: "test",
      ranAt: "2026-08-24T12:00:00.000Z",
      routes: { "/orders": { hit: true, statusCode: 500, ok: false } },
    };
    mockedGetReport.mockResolvedValue(report);
    renderPage();

    expect(await screen.findByText("500")).toBeInTheDocument();
  });

  it("falls back to 'error' text for a hit-but-failed route with no statusCode", async () => {
    const report: IntegrationTestReport = {
      target: "test",
      ranAt: "2026-08-24T12:00:00.000Z",
      routes: { "/orders": { hit: true, statusCode: null, ok: false } },
    };
    mockedGetReport.mockResolvedValue(report);
    renderPage();

    expect(await screen.findByText("error")).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedGetReport.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load the integration-test report: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedGetReport.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load the integration-test report.");
  });
});
