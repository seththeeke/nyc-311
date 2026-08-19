import { z } from "zod";

/*
 * Minimal DynamoDB Streams event shape (CLAUDE.md §5.2). `NewImage` stays a
 * loose AttributeValue map — `unmarshall` interprets it, not this schema.
 * `SequenceNumber` is required as the `itemIdentifier`
 * `reportBatchItemFailures` needs (`3-order-ingestion.md` §2.3).
 */

const AttributeValueMapSchema = z.record(z.string(), z.unknown());

export const RequestStreamRecordSchema = z.object({
  eventName: z.enum(["INSERT", "MODIFY", "REMOVE"]),
  dynamodb: z.object({
    NewImage: AttributeValueMapSchema.optional(),
    SequenceNumber: z.string().min(1),
  }),
});

export type RequestStreamRecord = z.infer<typeof RequestStreamRecordSchema>;

export const RequestStreamEventSchema = z.object({
  Records: z.array(RequestStreamRecordSchema),
});

export type RequestStreamEvent = z.infer<typeof RequestStreamEventSchema>;
