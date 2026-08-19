import type { Context } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { pollNyc311, recordPollerMetrics } from "../../service/ingestion/nyc311RequestService";
import type { PollResult } from "../../models/pollResult";
import { IngestionPollTriggerSchema } from "../../models/ingestionPollTrigger";
import { ValidationError } from "../../models/errors";
import type { PollerMetrics } from "../../models/pollerMetrics";

/**
 * NYC 311 poller entry point — invoked directly by an EventBridge Scheduler
 * target (1-data-ingestion.md). Validates the trigger, delegates to
 * `pollNyc311`, and lets failures propagate so the on-failure Destination
 * still fires.
 */
export const nyc311PollerController = async (event: unknown, context: Context): Promise<PollResult> => {
  logInfo("Nyc311PollerControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = IngestionPollTriggerSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("NYC 311 poller trigger payload failed validation", parsed.error.issues);
  }

  try {
    const result = await pollNyc311();
    logInfo("Nyc311PollerControllerCompleted", { result, awsRequestId: context.awsRequestId });
    await safelyRecordPollerMetrics({
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
    await safelyRecordPollerMetrics({
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
 * Records one poller run's outcome, swallowing its own failure — a
 * metrics-write problem must never mask the real poll result or block the
 * on-failure Destination from firing.
 */
async function safelyRecordPollerMetrics(metrics: PollerMetrics): Promise<void> {
  try {
    await recordPollerMetrics(metrics);
  } catch (err) {
    logError("Nyc311PollerControllerMetricsWriteFailed", {
      error: err instanceof Error ? err.message : err,
      metrics,
    });
  }
}
