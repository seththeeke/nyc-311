import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { logInfo } from "../../logger";
import type { LambdaHealth, LambdaHealthPoint } from "../../models/lambdaMetrics";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/*
 * Static, explicit list (not dynamic account-wide discovery) — the
 * Lambda-health tile is meant to be extensible by adding one entry here
 * plus one env var on the CDK construct (cdk/lambda/
 * Nyc311LambdaMetricsApiLambda.ts) when a new Lambda ships, not by
 * scanning every Lambda in the account (which would also sweep up CDK's
 * own auto-generated bucket-deployment/auto-delete-objects Lambdas).
 */
const MONITORED_LAMBDAS: { logicalName: string; envVar: string }[] = [
  { logicalName: "Poller", envVar: "MONITORED_LAMBDA_POLLER" },
  { logicalName: "OrderFanOut", envVar: "MONITORED_LAMBDA_ORDER_FAN_OUT" },
  { logicalName: "RequestEvaluation", envVar: "MONITORED_LAMBDA_REQUEST_EVALUATION" },
  { logicalName: "OrderEventFanOut", envVar: "MONITORED_LAMBDA_ORDER_EVENT_FAN_OUT" },
  { logicalName: "MetricsApi", envVar: "MONITORED_LAMBDA_METRICS_API" },
  { logicalName: "OrdersApi", envVar: "MONITORED_LAMBDA_ORDERS_API" },
  { logicalName: "PipelineStatus", envVar: "MONITORED_LAMBDA_PIPELINE_STATUS" },
];

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

async function getOneLambdaHealth(
  client: CloudWatchClient,
  logicalName: string,
  functionName: string,
  startTime: Date,
  endTime: Date
): Promise<LambdaHealth> {
  logInfo("GetLambdaHealthLambdaStarted", { logicalName, functionName });

  const [invocationPoints, errorPoints] = await Promise.all([
    fetchDailySum(client, functionName, "Invocations", startTime, endTime),
    fetchDailySum(client, functionName, "Errors", startTime, endTime),
  ]);

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
    }));

  logInfo("GetLambdaHealthLambdaCompleted", { logicalName, functionName, pointCount: points.length });
  return { logicalName, functionName, points };
}

/**
 * Basic invocation/success/failure health for every Lambda in
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

  logInfo("GetLambdaHealthStarted", { startTime, endTime, lambdaCount: MONITORED_LAMBDAS.length });

  const results = await Promise.all(
    MONITORED_LAMBDAS.map((lambda) =>
      getOneLambdaHealth(client, lambda.logicalName, requireEnv(lambda.envVar), startTime, endTime)
    )
  );

  logInfo("GetLambdaHealthCompleted", { lambdaCount: results.length });
  return results;
}
