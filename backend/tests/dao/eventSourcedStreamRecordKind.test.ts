import { describe, expect, it } from "vitest";
import {
  eventSourcedStreamRecordKind,
  type EventSourcedStreamRecord,
} from "../../dao/eventSourcedStreamRecordKind";

function record(eventName: EventSourcedStreamRecord["eventName"], sk?: unknown): EventSourcedStreamRecord {
  return { eventName, dynamodb: sk === undefined ? {} : { NewImage: { sk } } };
}

describe("eventSourcedStreamRecordKind", () => {
  it("routes an INSERT of an EVENT# row as an event", () => {
    expect(eventSourcedStreamRecordKind(record("INSERT", { S: "EVENT#3" }))).toBe("EVENT");
  });

  it("ignores a MODIFY or REMOVE of an EVENT# row, since events are immutable", () => {
    expect(eventSourcedStreamRecordKind(record("MODIFY", { S: "EVENT#3" }))).toBeNull();
    expect(eventSourcedStreamRecordKind(record("REMOVE", { S: "EVENT#3" }))).toBeNull();
  });

  it("routes an INSERT or MODIFY of the #METADATA row as the projection", () => {
    expect(eventSourcedStreamRecordKind(record("INSERT", { S: "#METADATA" }))).toBe("PROJECTION");
    expect(eventSourcedStreamRecordKind(record("MODIFY", { S: "#METADATA" }))).toBe("PROJECTION");
  });

  it("ignores a REMOVE of the #METADATA row", () => {
    expect(eventSourcedStreamRecordKind(record("REMOVE", { S: "#METADATA" }))).toBeNull();
  });

  it("ignores a record with no NewImage, a non-string sk or an unknown sk", () => {
    expect(eventSourcedStreamRecordKind(record("INSERT"))).toBeNull();
    expect(eventSourcedStreamRecordKind(record("INSERT", { N: "1" }))).toBeNull();
    expect(eventSourcedStreamRecordKind(record("INSERT", { S: 1 }))).toBeNull();
    expect(eventSourcedStreamRecordKind(record("INSERT", "EVENT#1"))).toBeNull();
    expect(eventSourcedStreamRecordKind(record("INSERT", null))).toBeNull();
    expect(eventSourcedStreamRecordKind(record("INSERT", { S: "CRID#x" }))).toBeNull();
  });
});
