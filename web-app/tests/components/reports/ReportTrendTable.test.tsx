import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ReportTrendTable } from "../../../src/components/reports/ReportTrendTable";
import type { Report } from "../../../src/models/report";

const report: Report = {
  job_name: "order_volume_by_stage_8w",
  title: "Order volume by stage — 8-week trend",
  run_date: "2026-09-04",
  computed_at: "2026-09-04T09:00:14.000Z",
  week_column: "week_start",
  series_column: "stage",
  value_column: "order_count",
  series: ["INGEST", "SCHEDULE"],
  weeks: [
    { week: "2026-07-13", values: { INGEST: 10, SCHEDULE: 30 } },
    { week: "2026-07-20", values: { SCHEDULE: 41 } },
  ],
};

describe("ReportTrendTable", () => {
  it("renders the title, job name and run date", () => {
    render(<ReportTrendTable report={report} />);

    expect(screen.getByRole("heading", { name: "Order volume by stage — 8-week trend" })).toBeInTheDocument();
    expect(screen.getByText(/order_volume_by_stage_8w/)).toBeInTheDocument();
    expect(screen.getByText(/run 2026-09-04/)).toBeInTheDocument();
  });

  it("renders one column per series plus a totals column", () => {
    render(<ReportTrendTable report={report} />);

    expect(screen.getByRole("columnheader", { name: "INGEST" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "SCHEDULE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "week_start" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
  });

  it("renders a row per week with a per-week total, and an em dash for a missing series", () => {
    render(<ReportTrendTable report={report} />);

    const firstWeek = screen.getByRole("row", { name: /2026-07-13/ });
    expect(within(firstWeek).getByText("40")).toBeInTheDocument();

    const secondWeek = screen.getByRole("row", { name: /2026-07-20/ });
    expect(within(secondWeek).getByText("–")).toBeInTheDocument();
    /* SCHEDULE cell (41) and the week total (41) — both present in this row. */
    expect(within(secondWeek).getAllByText("41")).toHaveLength(2);
  });

  it("renders a totals row summing each series and the grand total", () => {
    render(<ReportTrendTable report={report} />);

    const rows = screen.getAllByRole("row");
    const totalsRow = rows[rows.length - 1];
    expect(within(totalsRow).getByText("10")).toBeInTheDocument();
    expect(within(totalsRow).getByText("71")).toBeInTheDocument();
    expect(within(totalsRow).getByText("81")).toBeInTheDocument();
  });

  it("shows a placeholder when the report has no weeks", () => {
    render(<ReportTrendTable report={{ ...report, series: [], weeks: [] }} />);

    expect(screen.getByText(/no weeks yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
