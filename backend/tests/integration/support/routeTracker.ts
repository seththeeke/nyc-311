import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Not a coverage gate (4-pipeline-integration-tests.md §1/§4 — that was
 * explicitly declined) — just visibility into which of the known GET
 * routes actually got hit on a given run, and whether each returned
 * success. `httpClient.ts` calls `recordRouteHit` after every request it
 * makes, independent of whatever assertions the calling test makes
 * afterward, so the report reflects "did we reach it and get a response,"
 * not "did every assertion pass."
 */

const REPORT_DIR = path.join(__dirname, "..", "reports");
const REPORT_FILE = path.join(REPORT_DIR, "route-report.json");

export const KNOWN_ROUTES = ["/ingestion/metrics", "/orders", "/order-events", "/lambda-metrics"] as const;
export type KnownRoute = (typeof KNOWN_ROUTES)[number];

interface RouteReportEntry {
  hit: boolean;
  statusCode: number | null;
  ok: boolean;
}

export interface RouteReport {
  target: string;
  ranAt: string;
  routes: Record<KnownRoute, RouteReportEntry>;
}

function emptyReport(): RouteReport {
  const routes = {} as Record<KnownRoute, RouteReportEntry>;
  for (const route of KNOWN_ROUTES) {
    routes[route] = { hit: false, statusCode: null, ok: false };
  }
  return { target: process.env.INTEGRATION_TARGET ?? "unknown", ranAt: new Date().toISOString(), routes };
}

function readReport(): RouteReport {
  if (!fs.existsSync(REPORT_FILE)) return emptyReport();
  try {
    return JSON.parse(fs.readFileSync(REPORT_FILE, "utf8")) as RouteReport;
  } catch {
    return emptyReport(); /* a partial/corrupt write from an interrupted prior run — start fresh, not a crash */
  }
}

export function recordRouteHit(route: KnownRoute, statusCode: number): void {
  const report = readReport();
  report.ranAt = new Date().toISOString();
  report.routes[route] = { hit: true, statusCode, ok: statusCode >= 200 && statusCode < 300 };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
}

export function readCurrentReport(): RouteReport {
  return readReport();
}
