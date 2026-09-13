import type { AdHocQueryResult } from "../models/adHocQueryResult";

/*
 * Mock mode has no real Athena backing it — one canned resultset returned
 * regardless of the query text, same "no real dispatch loop to simulate"
 * shape as MockSchedulingService (7-data-warehousing.md §12a).
 */
export const MOCK_AD_HOC_QUERY_RESULT: AdHocQueryResult = {
  columns: [
    { name: "borough", type: "varchar" },
    { name: "order_count", type: "bigint" },
  ],
  rows: [
    { borough: "BROOKLYN", order_count: "812" },
    { borough: "QUEENS", order_count: "640" },
    { borough: "MANHATTAN", order_count: "511" },
    { borough: "BRONX", order_count: "398" },
    { borough: "STATEN ISLAND", order_count: "104" },
  ],
  row_count: 5,
  truncated: false,
  data_scanned_bytes: 48213,
  engine_execution_time_ms: 612,
};
