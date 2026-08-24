import { IntegrationTestReportSchema, type IntegrationTestReport } from "../models/integrationTestReport";
import { config } from "../config";
import { MOCK_INTEGRATION_TEST_REPORT } from "../test-data/integrationTestReport";

/* Same-origin static file synced by the pipeline's integration-test step (5-pipeline-integration-tests.md §5) — not config.apiBaseUrl, which is the separate Lambda-backed API Gateway origin. */
const REPORT_PATH = "/integration-tests/route-report.json";

export interface IntegrationTestReportService {
  getReport(): Promise<IntegrationTestReport>;
}

class LiveIntegrationTestReportService implements IntegrationTestReportService {
  async getReport(): Promise<IntegrationTestReport> {
    const response = await fetch(REPORT_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch integration-test report: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return IntegrationTestReportSchema.parse(body);
  }
}

class MockIntegrationTestReportService implements IntegrationTestReportService {
  async getReport(): Promise<IntegrationTestReport> {
    return MOCK_INTEGRATION_TEST_REPORT;
  }
}

export const integrationTestReportService: IntegrationTestReportService =
  config.dataMode === "live" ? new LiveIntegrationTestReportService() : new MockIntegrationTestReportService();
