import { AdHocQueryResultSchema, type AdHocQueryResult } from "../models/adHocQueryResult";
import { MOCK_AD_HOC_QUERY_RESULT } from "../test-data/adHocQueryResult";
import { authorizedFetch, readApiErrorMessage } from "./http";

/*
 * One interface, two implementations, selected by VITE_DATA_MODE at build time
 * (CLAUDE.md §5.1). Backs the admin
 * ad-hoc SQL console (7-data-warehousing.md §12a, Leg 7).
 */
export interface WarehouseQueryService {
  runQuery(sql: string): Promise<AdHocQueryResult>;
}

const READ_ONLY_LEADING_KEYWORDS = ["SELECT", "WITH", "SHOW", "DESCRIBE", "EXPLAIN"];
/* Leading whitespace and `--` / `/* *\/` comments, skipped before the first keyword — same as the backend's check. */
const LEADING_COMMENTS = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/;

class LiveWarehouseQueryService implements WarehouseQueryService {
  async runQuery(sql: string): Promise<AdHocQueryResult> {
    const response = await authorizedFetch("/admin/warehouse/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    });
    if (!response.ok) {
      throw new Error((await readApiErrorMessage(response)) ?? `Failed to run query: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return AdHocQueryResultSchema.parse(body);
  }
}

/*
 * Mock mode has no real Athena to run against — mirrors the controller's
 * own read-only statement-prefix check for a realistic 400, then returns
 * one canned resultset regardless of the exact query text.
 */
class MockWarehouseQueryService implements WarehouseQueryService {
  async runQuery(sql: string): Promise<AdHocQueryResult> {
    const firstKeyword = sql.replace(LEADING_COMMENTS, "").split(/\s+/)[0]?.toUpperCase() ?? "";
    if (!READ_ONLY_LEADING_KEYWORDS.includes(firstKeyword)) {
      throw new Error("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed");
    }
    return MOCK_AD_HOC_QUERY_RESULT;
  }
}

export const warehouseQueryService: WarehouseQueryService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LiveWarehouseQueryService() : new MockWarehouseQueryService();
