import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { monitoredLambdasSchema, type LambdaHealth, type LambdaHealthPoint } from "../../models/lambdaMetrics";

/*
 * The list is cdk/'s, not ours (#217): `MONITORED_LAMBDAS` holds every
 * Lambda the stack deploys, derived at synth, so a new Lambda needs no
 * edit here. Kept to the stack rather than scanning the account, which
 * would sweep up CDK's own helper Lambdas and the other env's fleet.
 */
function readMonitoredLambdas(): string[] {
  const raw = requireEnv("MONITORED_LAMBDAS");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MONITORED_LAMBDAS is not valid JSON");
  }
  return monitoredLambdasSchema.parse(parsed);
}

/* "Nyc311Poller-Test" → "Poller": the stable name the tile shows, the same in both environments. */
function toLogicalName(functionName: string): string {
  return functionName.replace(/^Nyc311/, "").replace(/-(Test|Prod)$/, "");
}

/** 7 days, daily buckets — enough to see a multi-day pattern (like the fan-out incident) without a heavy CloudWatch query. */
const LOOKBACK_DAYS = 7;
const PERIOD_SECONDS = 24 * 60 * 60;

export interface GetLambdaHealthDeps {
  client?: CloudWatchClient;
  now?: () => Date;
}

interface RawDatapoint {
  date: string;
  sum: number;
}

async function fetchDailySum(
  client: CloudWatchClient,
  functionName: string,
  metricName: string,
  startTime: Date,
  endTime: Date
): Promise<RawDatapoint[]> {
  const result = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: "AWS/Lambda",
      MetricName: metricName,
      Dimensions: [{ Name: "FunctionName", Value: functionName }],
      StartTime: startTime,
      EndTime: endTime,
      Period: PERIOD_SECONDS,
      Statistics: ["Sum"],
    })
  );
  return (result.Datapoints ?? [])
    .filter((dp): dp is { Timestamp: Date; Sum: number } => dp.Timestamp !== undefined && dp.Sum !== undefined)
    .map((dp) => ({ date: dp.Timestamp.toISOString().slice(0, 10), sum: dp.Sum }));
}

interface RawDurationDatapoint {
  date: string;
  average: number;
  maximum: number;
}

/* Lambda's built-in `Duration` (ms) — daily average and worst case, so a latency drift shows up without a custom metric. */
async function fetchDailyDuration(
  client: CloudWatchClient,
  functionName: string,
  startTime: Date,
  endTime: Date
): Promise<RawDurationDatapoint[]> {
  const result = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: "AWS/Lambda",
      MetricName: "Duration",
      Dimensions: [{ Name: "FunctionName", Value: functionName }],
      StartTime: startTime,
      EndTime: endTime,
      Period: PERIOD_SECONDS,
      Statistics: ["Average", "Maximum"],
    })
  );
  return (result.Datapoints ?? [])
    .filter(
      (dp): dp is { Timestamp: Date; Average: number; Maximum: number } =>
        dp.Timestamp !== undefined && dp.Average !== undefined && dp.Maximum !== undefined
    )
    .map((dp) => ({ date: dp.Timestamp.toISOString().slice(0, 10), average: dp.Average, maximum: dp.Maximum }));
}

/* Whole milliseconds — sub-ms precision is noise on a daily bucket. */
function roundMs(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value);
}

async function getOneLambdaHealth(
  client: CloudWatchClient,
  logicalName: string,
  functionName: string,
  startTime: Date,
  endTime: Date
): Promise<LambdaHealth> {
  logInfo("GetLambdaHealthLambdaStarted", { logicalName, functionName });

  const [invocationPoints, errorPoints, durationPoints] = await Promise.all([
    fetchDailySum(client, functionName, "Invocations", startTime, endTime),
    fetchDailySum(client, functionName, "Errors", startTime, endTime),
    fetchDailyDuration(client, functionName, startTime, endTime),
  ]);
  const durationByDate = new Map(durationPoints.map((dp) => [dp.date, dp]));

  const byDate = new Map<string, { invocations: number; errors: number }>();
  for (const { date, sum } of invocationPoints) {
    byDate.set(date, { invocations: sum, errors: byDate.get(date)?.errors ?? 0 });
  }
  for (const { date, sum } of errorPoints) {
    byDate.set(date, { invocations: byDate.get(date)?.invocations ?? 0, errors: sum });
  }

  const points: LambdaHealthPoint[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      invocations: counts.invocations,
      errors: counts.errors,
      successes: counts.invocations - counts.errors,
      avgDurationMs: roundMs(durationByDate.get(date)?.average),
      maxDurationMs: roundMs(durationByDate.get(date)?.maximum),
    }));

  logInfo("GetLambdaHealthLambdaCompleted", { logicalName, functionName, pointCount: points.length });
  return { logicalName, functionName, points };
}

/**
 * Basic invocation/success/failure health, plus daily latency, for every Lambda in
 * `MONITORED_LAMBDAS`, over the last `LOOKBACK_DAYS` — backs the public
 * `GET /lambda-metrics` route (`controller/web-api/
 * getLambdaMetricsController.ts`). Added after the 2026-08-22
 * fan-out-Lambda incident, where a Lambda erroring on every single
 * invocation went unnoticed for days with nothing surfacing it in the UI.
 */
export async function getLambdaHealth(deps: GetLambdaHealthDeps = {}): Promise<LambdaHealth[]> {
  const client = deps.client ?? new CloudWatchClient({});
  const now = deps.now ?? (() => new Date());
  const endTime = now();
  const startTime = new Date(endTime.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const functionNames = readMonitoredLambdas();
  logInfo("GetLambdaHealthStarted", { startTime, endTime, lambdaCount: functionNames.length });

  const results = await Promise.all(
    functionNames.map((functionName) =>
      getOneLambdaHealth(client, toLogicalName(functionName), functionName, startTime, endTime)
    )
  );

  logInfo("GetLambdaHealthCompleted", { lambdaCount: results.length });
  return results;
}
