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
const PARTIAL_DIR = path.join(REPORT_DIR, "partials");

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

interface RoutePartial extends RouteReportEntry {
  ranAt: string;
}

function partialFile(route: KnownRoute): string {
  return path.join(PARTIAL_DIR, `${route.replace(/\//g, "_")}.json`);
}

function emptyReport(): RouteReport {
  const routes = {} as Record<KnownRoute, RouteReportEntry>;
  for (const route of KNOWN_ROUTES) {
    routes[route] = { hit: false, statusCode: null, ok: false };
  }
  return { target: process.env.INTEGRATION_TARGET ?? "unknown", ranAt: new Date().toISOString(), routes };
}

/**
 * Each known route is exercised by exactly one `*.integration.test.ts`
 * file, so writing one file per route (rather than read-modify-write of a
 * single shared route-report.json) means parallel test-file workers never
 * contend — that write race was the only reason the suite pinned
 * `fileParallelism: false`. The whole route-report.json is folded
 * together once, after the run, by `mergePartialsIntoReport`.
 */
export function recordRouteHit(route: KnownRoute, statusCode: number): void {
  fs.mkdirSync(PARTIAL_DIR, { recursive: true });
  const partial: RoutePartial = {
    hit: true,
    statusCode,
    ok: statusCode >= 200 && statusCode < 300,
    ranAt: new Date().toISOString(),
  };
  fs.writeFileSync(partialFile(route), JSON.stringify(partial, null, 2));
}

/**
 * Clears any partials/report left by a previous run and drops a
 * not-yet-hit skeleton in place, so a hard crash mid-run still leaves a
 * valid (if empty) route-report.json for the pipeline's sync step.
 */
export function resetReport(): void {
  fs.rmSync(PARTIAL_DIR, { recursive: true, force: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(emptyReport(), null, 2));
}

/** Folds the per-route partials into the final route-report.json. */
export function mergePartialsIntoReport(): RouteReport {
  const report = emptyReport();
  const ranAts: string[] = [];
  for (const route of KNOWN_ROUTES) {
    const file = partialFile(route);
    if (!fs.existsSync(file)) continue;
    try {
      const partial = JSON.parse(fs.readFileSync(file, "utf8")) as RoutePartial;
      report.routes[route] = { hit: partial.hit, statusCode: partial.statusCode, ok: partial.ok };
      ranAts.push(partial.ranAt);
    } catch {
      /* a partial/corrupt write from an interrupted worker — leave that route not-hit, don't crash the summary */
    }
  }
  if (ranAts.length > 0) {
    ranAts.sort();
    report.ranAt = ranAts[ranAts.length - 1];
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  return report;
}
