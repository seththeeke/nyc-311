import { config } from "../config";
import {
  CodeQualityReportListSchema,
  CodeQualityReportSchema,
  type CodeQualityReport,
  type CodeQualityReportSummary,
} from "../models/codeQualityReport";
import { MOCK_CODE_QUALITY_REPORTS } from "../test-data/codeQualityReports";

/* One interface, live and in-memory implementations, chosen by VITE_DATA_MODE (CLAUDE.md §5.1). */
export interface CodeQualityReportService {
  listReports(): Promise<CodeQualityReportSummary[]>;
  getReport(date: string, time: string): Promise<CodeQualityReport>;
}

class LiveCodeQualityReportService implements CodeQualityReportService {
  async listReports(): Promise<CodeQualityReportSummary[]> {
    const response = await fetch(`${config.apiBaseUrl}/monitoring/code-quality/reports`);
    if (!response.ok) throw new Error(`Failed to fetch code quality reports: HTTP ${response.status}`);
    return CodeQualityReportListSchema.parse(await response.json()).reports;
  }

  async getReport(date: string, time: string): Promise<CodeQualityReport> {
    const response = await fetch(`${config.apiBaseUrl}/monitoring/code-quality/reports/${encodeURIComponent(date)}/${encodeURIComponent(time)}`);
    if (!response.ok) throw new Error(`Failed to fetch the code quality report: HTTP ${response.status}`);
    return CodeQualityReportSchema.parse(await response.json());
  }
}

class MockCodeQualityReportService implements CodeQualityReportService {
  async listReports(): Promise<CodeQualityReportSummary[]> {
    return MOCK_CODE_QUALITY_REPORTS.map(({ date, time, package: pkg, score, previous }) => ({ date, time, package: pkg, score, previous }));
  }

  async getReport(date: string, time: string): Promise<CodeQualityReport> {
    const report = MOCK_CODE_QUALITY_REPORTS.find((r) => r.date === date && r.time === time);
    if (!report) throw new Error("No code quality report for that run");
    return report;
  }
}

export const codeQualityReportService: CodeQualityReportService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LiveCodeQualityReportService() : new MockCodeQualityReportService();
