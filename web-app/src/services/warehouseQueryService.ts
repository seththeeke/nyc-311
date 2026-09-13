import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";
import { AdHocQueryResultSchema, type AdHocQueryResult } from "../models/adHocQueryResult";
import { MOCK_AD_HOC_QUERY_RESULT } from "../test-data/adHocQueryResult";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as schedulingService. Backs the admin
 * ad-hoc SQL console (7-data-warehousing.md §12a, Leg 7).
 */
export interface WarehouseQueryService {
  runQuery(sql: string): Promise<AdHocQueryResult>;
}

const READ_ONLY_LEADING_KEYWORDS = ["SELECT", "WITH", "SHOW", "DESCRIBE", "EXPLAIN"];

class LiveWarehouseQueryService implements WarehouseQueryService {
  async runQuery(sql: string): Promise<AdHocQueryResult> {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) {
      throw new Error("Not authenticated");
    }
    const response = await fetch(`${config.apiBaseUrl}/admin/warehouse/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ sql }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Failed to run query: HTTP ${response.status}`);
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
    const firstKeyword = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
    if (!READ_ONLY_LEADING_KEYWORDS.includes(firstKeyword)) {
      throw new Error("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed");
    }
    return MOCK_AD_HOC_QUERY_RESULT;
  }
}

export const warehouseQueryService: WarehouseQueryService =
  config.dataMode === "live" ? new LiveWarehouseQueryService() : new MockWarehouseQueryService();
