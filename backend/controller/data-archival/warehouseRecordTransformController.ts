import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import {
  FirehoseTransformEventSchema,
  type FirehoseTransformResponse,
  type FirehoseTransformResponseRecord,
} from "../../models/firehoseTransformEvent";
import { transformFirehoseRecordData } from "../../service/analytics/warehouseRecordTransformService";

/**
 * The Kinesis Data Firehose data-transformation entry point shared by all
 * three warehouse delivery streams (`7-data-warehousing.md` §5/§7). Per
 * record: re-serialize the opaque JSON fields to strings and stamp
 * `warehouse_ingested_at`/`ingestion_source`, so the record matches the
 * Glue schema Firehose then converts to Parquet against.
 */
export const warehouseRecordTransformController = async (
  event: unknown,
  context: Context
): Promise<FirehoseTransformResponse> => {
  const parsed = FirehoseTransformEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Firehose transform event failed validation", parsed.error.issues);
  }

  logInfo("WarehouseRecordTransformInvoked", {
    recordCount: parsed.data.records.length,
    awsRequestId: context.awsRequestId,
  });

  let okCount = 0;
  const records: FirehoseTransformResponseRecord[] = parsed.data.records.map((record) => {
    const { data, ok } = transformFirehoseRecordData(record.data);
    if (ok) okCount += 1;
    return { recordId: record.recordId, result: ok ? "Ok" : "ProcessingFailed", data };
  });

  logInfo("WarehouseRecordTransformCompleted", {
    recordCount: records.length,
    okCount,
    failedCount: records.length - okCount,
    awsRequestId: context.awsRequestId,
  });
  return { records };
};
