import { z } from "zod";

/*
 * Minimal DynamoDB Streams event shape (CLAUDE.md §5.2), same pattern as
 * orderStreamEvent.ts / locationStreamEvent.ts. `NewImage` stays a loose
 * AttributeValue map — unmarshall/the sk-prefix check interpret it, not
 * this schema.
 */

const AttributeValueMapSchema = z.record(z.string(), z.unknown());

export const OperatorStreamRecordSchema = z.object({
  eventName: z.enum(["INSERT", "MODIFY", "REMOVE"]),
  dynamodb: z.object({
    NewImage: AttributeValueMapSchema.optional(),
    SequenceNumber: z.string().min(1),
  }),
});

export type OperatorStreamRecord = z.infer<typeof OperatorStreamRecordSchema>;

export const OperatorStreamEventSchema = z.object({
  Records: z.array(OperatorStreamRecordSchema),
});

export type OperatorStreamEvent = z.infer<typeof OperatorStreamEventSchema>;
