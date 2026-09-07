import { z } from "zod";

/*
 * Minimal DynamoDB Streams event shape (CLAUDE.md §5.2), same as
 * `requestStreamEvent.ts` / `orderStreamEvent.ts`. `NewImage` stays a
 * loose AttributeValue map — `unmarshall` interprets it, not this schema.
 * `SequenceNumber` is the `itemIdentifier` `reportBatchItemFailures`
 * needs. `Locations` is written once per `bbl` (findOrCreate) and never
 * updated, so in practice only `INSERT` records arrive here.
 */

const AttributeValueMapSchema = z.record(z.string(), z.unknown());

export const LocationStreamRecordSchema = z.object({
  eventName: z.enum(["INSERT", "MODIFY", "REMOVE"]),
  dynamodb: z.object({
    NewImage: AttributeValueMapSchema.optional(),
    SequenceNumber: z.string().min(1),
  }),
});

export type LocationStreamRecord = z.infer<typeof LocationStreamRecordSchema>;

export const LocationStreamEventSchema = z.object({
  Records: z.array(LocationStreamRecordSchema),
});

export type LocationStreamEvent = z.infer<typeof LocationStreamEventSchema>;
