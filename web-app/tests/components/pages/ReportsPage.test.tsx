import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportsPage } from "../../../src/components/pages/ReportsPage";
import { reportsService } from "../../../src/services/reportsService";
import type { ReportsResponse } from "../../../src/models/report";

vi.mock("../../../src/services/reportsService", () => ({
  reportsService: { getReports: vi.fn() },
}));

const mockedGetReports = vi.mocked(reportsService.getReports);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const response: ReportsResponse = {
  reports: [
    {
      job_name: "order_volume_by_stage_8w",
      title: "Order volume by stage — 8-week trend",
      run_date: "2026-09-04",
      computed_at: "2026-09-04T09:00:14.000Z",
      week_column: "week_start",
      series_column: "stage",
      value_column: "order_count",
      series: ["SCHEDULE"],
      weeks: [{ week: "2026-07-13", values: { SCHEDULE: 30 } }],
    },
  ],
};

beforeEach(() => {
  mockedGetReports.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportsPage", () => {
  it("shows a loading state, then the heading and a link back to Monitoring", () => {
    mockedGetReports.mockResolvedValue({ reports: [] });
    renderPage();

    expect(screen.getByRole("heading", { name: "Reports", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders one trend card per report once data resolves", async () => {
    mockedGetReports.mockResolvedValue(response);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Order volume by stage — 8-week trend" })
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "SCHEDULE" })).toBeInTheDocument();
  });

  it("shows an empty-state message when no report has produced a result", async () => {
    mockedGetReports.mockResolvedValue({ reports: [] });
    renderPage();

    expect(await screen.findByText(/no reports have produced a result yet/i)).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedGetReports.mockRejectedValue(new Error("HTTP 503"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load reports: HTTP 503");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedGetReports.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load reports.");
  });
});
