import type { IntegrationTestReport } from "../models/integrationTestReport";

/* Baked sample data for "mock" data mode (config.ts) — every known GET route healthy. */
export const MOCK_INTEGRATION_TEST_REPORT: IntegrationTestReport = {
  target: "test",
  ranAt: "2026-08-24T12:00:00.000Z",
  routes: {
    "/ingestion/metrics": { hit: true, statusCode: 200, ok: true },
    "/orders": { hit: true, statusCode: 200, ok: true },
    "/order-events": { hit: true, statusCode: 200, ok: true },
    "/lambda-metrics": { hit: true, statusCode: 200, ok: true },
    "/data/schema": { hit: true, statusCode: 200, ok: true },
    "/data/jobs": { hit: true, statusCode: 200, ok: true },
    "/data/jobs/{name}/result": { hit: true, statusCode: 200, ok: true },
  },
};
