import { config } from "../config";
import { ReportsResponseSchema, type ReportsResponse } from "../models/report";
import { MOCK_REPORTS } from "../test-data/reports";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as warehouseDataService.ts. Backs
 * GET /reports (7-data-warehousing.md §12), the centralized reporting
 * surface behind the Monitoring "Reports" tile.
 */
export interface ReportsService {
  getReports(): Promise<ReportsResponse>;
}

class LiveReportsService implements ReportsService {
  async getReports(): Promise<ReportsResponse> {
    const response = await fetch(`${config.apiBaseUrl}/reports`);
    if (!response.ok) {
      throw new Error(`Failed to fetch reports: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return ReportsResponseSchema.parse(body);
  }
}

class MockReportsService implements ReportsService {
  async getReports(): Promise<ReportsResponse> {
    return MOCK_REPORTS;
  }
}

export const reportsService: ReportsService =
  config.dataMode === "live" ? new LiveReportsService() : new MockReportsService();
