import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CodeQualityReportView } from "../../../src/components/codeQuality/CodeQualityReportView";
import { codeQualityReportService } from "../../../src/services/codeQualityReportService";

vi.mock("../../../src/services/codeQualityReportService", () => ({ codeQualityReportService: { listReports: vi.fn(), getReport: vi.fn() } }));

const MARKDOWN = [
  "# backend · 64/100",
  "",
  "| Audit | Score |",
  "|---|---|",
  "| Complexity | 13/20 |",
  "",
  "**Verdict:** see [#201](https://github.com/x/y/issues/201) and `schedulingService.ts`.",
  "",
  "## Findings",
  "1. First",
  "",
  "### Notes",
  "- a bullet",
  "",
  "<script>alert(1)</script>",
].join("\n");

describe("CodeQualityReportView", () => {
  it("renders every part of a report's Markdown, but never raw HTML", async () => {
    vi.mocked(codeQualityReportService.getReport).mockResolvedValue({ date: "2026-11-09", time: "23_30", package: "backend", score: 64, previous: 58, markdown: MARKDOWN });
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CodeQualityReportView date="2026-11-09" time="23_30" />
      </QueryClientProvider>
    );
    expect(screen.getByText("Loading the report…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "backend · 64/100" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Report for Nov 9, 2026 · 23:30 CT" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Findings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Audit" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "13/20" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#201" })).toHaveAttribute("target", "_blank");
    expect(screen.getByText("schedulingService.ts").tagName).toBe("CODE");
    expect(screen.getByText("Verdict:").tagName).toBe("STRONG");
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(container.querySelector("script")).toBeNull();
  });
});
