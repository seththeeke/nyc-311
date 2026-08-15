import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Context } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { RequestDao } from "../../dao/request/requestDao";
import { pollNyc311 } from "../../service/ingestion/nyc311PollerService";
import type { PollResult } from "../../models/pollResult";
import { IngestionPollTriggerSchema } from "../../models/ingestionPollTrigger";
import { ValidationError } from "../../models/errors";
import type { PollerMetrics } from "../../models/pollerMetrics";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Constructed once at module scope (Lambda cold start) and reused across
// warm invocations, rather than rebuilt per call — per CLAUDE.md §5.2.
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const requestDao = new RequestDao(ddbClient, requireEnv("REQUESTS_TABLE_NAME"));

/**
 * Entry point for the NYC 311 poller — invoked directly by an EventBridge
 * Scheduler target (no Step Functions/API Gateway envelope; the event is
 * exactly the Scheduler's configured Input), per 1-data-ingestion.md.
 * Validates that payload into a structured model, delegates to
 * `pollNyc311`, and lets any failure propagate so the Lambda's
 * on-failure Destination (1-data-ingestion.md §5) actually fires — this
 * controller never swallows an error, only logs it on the way out.
 */
export const nyc311PollerController = async (event: unknown, context: Context): Promise<PollResult> => {
  logInfo("Nyc311PollerControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = IngestionPollTriggerSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("NYC 311 poller trigger payload failed validation", parsed.error.issues);
  }

  try {
    const result = await pollNyc311({ requestDao });
    logInfo("Nyc311PollerControllerCompleted", { result, awsRequestId: context.awsRequestId });
    await recordPollerMetrics({
      ran_at: new Date().toISOString(),
      success: true,
      records_ingested: result.recordsIngested,
      duplicates_skipped: result.duplicatesSkipped,
      records_rejected: result.recordsRejected,
      error_message: null,
    });
    return result;
  } catch (err) {
    logError("Nyc311PollerControllerFailed", {
      error: err instanceof Error ? err.message : err,
      awsRequestId: context.awsRequestId,
    });
    await recordPollerMetrics({
      ran_at: new Date().toISOString(),
      success: false,
      records_ingested: 0,
      duplicates_skipped: 0,
      records_rejected: 0,
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};

/**
 * Writes one poller run's outcome (1-data-ingestion.md §8a), swallowing any
 * failure of the write itself — a metrics-recording problem must never mask
 * or replace the real success/failure of the poll it's describing, on
 * either path. On the failure path in particular, this runs *after*
 * `Nyc311PollerControllerFailed` is already logged and *before* the
 * original error is rethrown, so the Lambda's on-failure Destination still
 * fires exactly as it did before this existed.
 */
async function recordPollerMetrics(metrics: PollerMetrics): Promise<void> {
  try {
    await requestDao.putPollerMetrics(metrics);
  } catch (err) {
    logError("Nyc311PollerControllerMetricsWriteFailed", {
      error: err instanceof Error ? err.message : err,
      metrics,
    });
  }
}
