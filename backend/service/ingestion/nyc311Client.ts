import { logError, logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";

// The Socrata Open Data ("SODA") dataset backing NYC 311 — same endpoint
// `311-test-data/pull-nyc-311-data.js` uses to pull sample data.
const SODA_ENDPOINT = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

export interface FetchNyc311PageParams {
  /** SoQL floating_timestamp (no ms/timezone suffix) — see {@link toSoqlTimestamp}. Exclusive lower bound. */
  sinceExclusive: string;
  offset: number;
  limit: number;
}

/**
 * SoQL's floating_timestamp type rejects milliseconds/timezone suffixes
 * (e.g. from `Date#toISOString()`) as a text/timestamp mismatch, per
 * `311-test-data/pull-nyc-311-data.js`.
 */
export function toSoqlTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

/**
 * Fetches one page of raw NYC 311 records, ordered `created_date ASC,
 * unique_key ASC` (a tie-break on the sort is required for offset-based
 * pagination to be stable when multiple records share a `created_date`).
 * Records are returned as `unknown` — deciding whether an individual record
 * is usable (has `unique_key`/`created_date`) is the poller service's job,
 * not this client's; this layer only confirms the response itself is a
 * JSON array.
 */
export async function fetchNyc311Page(params: FetchNyc311PageParams): Promise<unknown[]> {
  const { sinceExclusive, offset, limit } = params;
  const query = new URLSearchParams({
    $where: `created_date > '${sinceExclusive}'`,
    $order: "created_date ASC, unique_key ASC",
    $limit: String(limit),
    $offset: String(offset),
  });
  const headers: Record<string, string> = {};
  if (process.env.SOCRATA_APP_TOKEN) {
    headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  }

  logInfo("fetchNyc311Page", { sinceExclusive, offset, limit });
  const response = await fetch(`${SODA_ENDPOINT}?${query}`, { headers });
  if (!response.ok) {
    logError("fetchNyc311PageFailed", {
      sinceExclusive,
      offset,
      limit,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`NYC 311 SODA API request failed: ${response.status} ${response.statusText}`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    logError("fetchNyc311PageMalformedResponse", { sinceExclusive, offset, limit });
    throw new ValidationError("NYC 311 SODA API response was not a JSON array", body);
  }
  logInfo("fetchNyc311PageSucceeded", { sinceExclusive, offset, limit, recordCount: body.length });
  return body;
}
