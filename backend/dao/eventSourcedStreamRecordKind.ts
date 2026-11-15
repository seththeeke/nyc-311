import { eventSourcedItemKind, type EventSourcedItemKind } from "./eventSourcedItemKind";

/** The fields of a DynamoDB Streams record this classifier reads. */
export interface EventSourcedStreamRecord {
  eventName: "INSERT" | "MODIFY" | "REMOVE";
  dynamodb: { NewImage?: Record<string, unknown> };
}

/** Extracts a string `sk` from a stream record's `NewImage`, or `null`. */
function newImageSk(record: EventSourcedStreamRecord): string | null {
  const sk = record.dynamodb.NewImage?.["sk"];
  if (typeof sk === "object" && sk !== null && "S" in sk && typeof (sk as { S: unknown }).S === "string") {
    return (sk as { S: string }).S;
  }
  return null;
}

/**
 * Classifies an event-sourced table's stream record for fan-out: `EVENT`
 * for an appended event (an `INSERT` only, since events are immutable),
 * `PROJECTION` for an `INSERT` or `MODIFY` of the `#METADATA` row, and
 * `null` for anything else (a `REMOVE`, or an unknown `sk`).
 */
export function eventSourcedStreamRecordKind(record: EventSourcedStreamRecord): EventSourcedItemKind | null {
  const kind = eventSourcedItemKind(newImageSk(record));
  if (kind === "EVENT") return record.eventName === "INSERT" ? "EVENT" : null;
  if (kind === "PROJECTION") return record.eventName === "REMOVE" ? null : "PROJECTION";
  return null;
}
