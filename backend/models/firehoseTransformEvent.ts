import { z } from "zod";

/*
 * The Kinesis Data Firehose data-transformation invocation shape
 * (`7-data-warehousing.md` §5) — validated first per `CLAUDE.md` §5.2.
 * `data` is base64-encoded; the handler decodes/re-encodes it.
 */
export const FirehoseTransformRecordSchema = z.object({
  recordId: z.string().min(1),
  data: z.string(),
});
export type FirehoseTransformRecord = z.infer<typeof FirehoseTransformRecordSchema>;

export const FirehoseTransformEventSchema = z.object({
  records: z.array(FirehoseTransformRecordSchema),
});
export type FirehoseTransformEvent = z.infer<typeof FirehoseTransformEventSchema>;

export type FirehoseTransformResult = "Ok" | "Dropped" | "ProcessingFailed";

export interface FirehoseTransformResponseRecord {
  recordId: string;
  result: FirehoseTransformResult;
  data: string;
}

export interface FirehoseTransformResponse {
  records: FirehoseTransformResponseRecord[];
}
