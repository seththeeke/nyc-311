import { CloudWatchClient, GetMetricDataCommand, type MetricDataQuery, type MetricDataResult } from "@aws-sdk/client-cloudwatch";
import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import type { PublicApiMetrics, PublicApiMetricsPoint } from "../../models/publicApiMetrics";

const WINDOW_HOURS = 24;
const PERIOD_SECONDS = 60 * 60;
const WINDOW_SECONDS = WINDOW_HOURS * PERIOD_SECONDS;

export interface GetPublicApiMetricsDeps {
  client?: CloudWatchClient;
  now?: () => Date;
  apiId?: string;
}

/* One API Gateway metric for the public API, at the given period. */
function query(id: string, apiId: string, metricName: string, stat: string, period: number): MetricDataQuery {
  return {
    Id: id,
    MetricStat: {
      Metric: { Namespace: "AWS/ApiGateway", MetricName: metricName, Dimensions: [{ Name: "ApiId", Value: apiId }] },
      Period: period,
      Stat: stat,
    },
  };
}

function valuesByTime(result: MetricDataResult | undefined): Map<string, number> {
  const values = new Map<string, number>();
  (result?.Timestamps ?? []).forEach((timestamp, index) => {
    const value = result?.Values?.[index];
    if (value !== undefined) values.set(timestamp.toISOString(), value);
  });
  return values;
}

/* A single whole-window value, or null when the API had no traffic. */
function firstValue(result: MetricDataResult | undefined): number | null {
  return result?.Values?.[0] ?? null;
}

/**
 * The public API's last 24 hours (16-resident-action-models.md §6.2):
 * hourly request, 4xx, 5xx and latency p50/p99 points from API Gateway's
 * built-in metrics, plus whole-window totals. No custom metrics.
 */
export async function getPublicApiMetrics(deps: GetPublicApiMetricsDeps = {}): Promise<PublicApiMetrics> {
  const client = deps.client ?? new CloudWatchClient({});
  const apiId = deps.apiId ?? requireEnv("PUBLIC_API_ID");
  const endTime = (deps.now ?? (() => new Date()))();
  endTime.setUTCMinutes(0, 0, 0);
  endTime.setUTCHours(endTime.getUTCHours() + 1);
  const startTime = new Date(endTime.getTime() - WINDOW_SECONDS * 1000);
  logInfo("PublicApiMetricsFetching", { apiId, startTime: startTime.toISOString(), endTime: endTime.toISOString() });

  const result = await client.send(
    new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: [
        query("requests", apiId, "Count", "Sum", PERIOD_SECONDS),
        query("clientErrors", apiId, "4xx", "Sum", PERIOD_SECONDS),
        query("serverErrors", apiId, "5xx", "Sum", PERIOD_SECONDS),
        query("p50", apiId, "Latency", "p50", PERIOD_SECONDS),
        query("p99", apiId, "Latency", "p99", PERIOD_SECONDS),
        query("totalP50", apiId, "Latency", "p50", WINDOW_SECONDS),
        query("totalP99", apiId, "Latency", "p99", WINDOW_SECONDS),
      ],
    })
  );
  const byId = new Map((result.MetricDataResults ?? []).map((r) => [r.Id, r]));
  const series = {
    requests: valuesByTime(byId.get("requests")),
    clientErrors: valuesByTime(byId.get("clientErrors")),
    serverErrors: valuesByTime(byId.get("serverErrors")),
    p50: valuesByTime(byId.get("p50")),
    p99: valuesByTime(byId.get("p99")),
  };

  const points: PublicApiMetricsPoint[] = [];
  for (let t = startTime.getTime(); t < endTime.getTime(); t += PERIOD_SECONDS * 1000) {
    const timestamp = new Date(t).toISOString();
    points.push({
      timestamp,
      requests: series.requests.get(timestamp) ?? 0,
      client_errors: series.clientErrors.get(timestamp) ?? 0,
      server_errors: series.serverErrors.get(timestamp) ?? 0,
      latency_p50_ms: series.p50.get(timestamp) ?? null,
      latency_p99_ms: series.p99.get(timestamp) ?? null,
    });
  }
  const sum = (key: "requests" | "client_errors" | "server_errors") => points.reduce((total, point) => total + point[key], 0);
  const metrics: PublicApiMetrics = {
    window_hours: WINDOW_HOURS,
    period_seconds: PERIOD_SECONDS,
    totals: {
      requests: sum("requests"),
      client_errors: sum("client_errors"),
      server_errors: sum("server_errors"),
      latency_p50_ms: firstValue(byId.get("totalP50")),
      latency_p99_ms: firstValue(byId.get("totalP99")),
    },
    points,
  };
  logInfo("PublicApiMetricsFetched", { apiId, ...metrics.totals });
  return metrics;
}
