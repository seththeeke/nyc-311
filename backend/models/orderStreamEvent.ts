import { z } from "zod";

/*
 * Minimal DynamoDB Streams event shape (CLAUDE.md §5.2), same pattern as
 * requestStreamEvent.ts. `NewImage` stays a loose AttributeValue map —
 * unmarshall/the sk-prefix check interpret it, not this schema.
 */

const AttributeValueMapSchema = z.record(z.string(), z.unknown());

export const OrderStreamRecordSchema = z.object({
  eventName: z.enum(["INSERT", "MODIFY", "REMOVE"]),
  dynamodb: z.object({
    NewImage: AttributeValueMapSchema.optional(),
    SequenceNumber: z.string().min(1),
  }),
});

export type OrderStreamRecord = z.infer<typeof OrderStreamRecordSchema>;

export const OrderStreamEventSchema = z.object({
  Records: z.array(OrderStreamRecordSchema),
});

export type OrderStreamEvent = z.infer<typeof OrderStreamEventSchema>;
