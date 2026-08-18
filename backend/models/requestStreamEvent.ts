import { z } from "zod";

// The minimal DynamoDB Streams Lambda event shape this controller needs,
// per CLAUDE.md §5.2 ("parse the raw trigger payload first"). `NewImage`/
// `Keys` are DynamoDB's own AttributeValue-wrapped JSON — deliberately kept
// as a loose `Record<string, unknown>` here rather than modeling the full
// recursive AttributeValue union; `@aws-sdk/util-dynamodb`'s `unmarshall`
// (called in `service/ingestion/nyc311RequestService.ts`) is what
// actually interprets that shape, not this schema. `SequenceNumber` is
// required — it's the `itemIdentifier` `reportBatchItemFailures` needs to
// report a single failed record without retrying its whole batch
// (`3-order-ingestion.md` §2.3).

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
