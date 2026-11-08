import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CodeQualityPage } from "../../../src/components/pages/CodeQualityPage";
import { codeQualityReportService } from "../../../src/services/codeQualityReportService";
import { MOCK_CODE_QUALITY_REPORTS } from "../../../src/test-data/codeQualityReports";

vi.mock("../../../src/services/codeQualityReportService", () => ({ codeQualityReportService: { listReports: vi.fn(), getReport: vi.fn() } }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CodeQualityPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(codeQualityReportService.listReports).mockReset();
  vi.mocked(codeQualityReportService.getReport).mockReset();
  vi.mocked(codeQualityReportService.getReport).mockImplementation(async (date, time) => {
    const report = MOCK_CODE_QUALITY_REPORTS.find((r) => r.date === date && r.time === time);
    if (!report) throw new Error("gone");
    return report;
  });
});

describe("CodeQualityPage", () => {
  it("shows the latest score per package, every report, and the newest report in full", async () => {
    vi.mocked(codeQualityReportService.listReports).mockResolvedValue(MOCK_CODE_QUALITY_REPORTS);
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Code Quality" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    const scores = await screen.findByRole("region", { name: "Latest score per package" });
    expect(within(scores).getAllByRole("listitem")).toHaveLength(2);
    expect(within(scores).getByText("↑ 6")).toBeInTheDocument();
    const rows = within(screen.getByRole("region", { name: "Reports" })).getAllByRole("row");
    expect(rows).toHaveLength(MOCK_CODE_QUALITY_REPORTS.length + 1);
    expect(await screen.findByText(/Disciplined layering/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nov 9, 2026 · 23:30 CT" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens another report when its run is chosen", async () => {
    vi.mocked(codeQualityReportService.listReports).mockResolvedValue(MOCK_CODE_QUALITY_REPORTS);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Nov 5, 2026 · 23:30 CT" }));
    expect(await screen.findByText(/Components are small and consistent/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nov 5, 2026 · 23:30 CT" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says when a report can't be loaded", async () => {
    vi.mocked(codeQualityReportService.listReports).mockResolvedValue([{ date: "2026-01-01", time: "00_00", package: "cdk", score: null, previous: null }]);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this report: gone");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the loading, empty and failed states", async () => {
    vi.mocked(codeQualityReportService.listReports).mockResolvedValueOnce([]);
    const empty = renderPage();
    expect(screen.getByText("Loading reports…")).toBeInTheDocument();
    expect(await screen.findByText(/No reports yet/)).toBeInTheDocument();
    empty.unmount();
    vi.mocked(codeQualityReportService.listReports).mockRejectedValueOnce(new Error("HTTP 500"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the reports: HTTP 500");
  });
});
