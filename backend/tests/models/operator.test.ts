import { describe, expect, it } from "vitest";
import { OperatorEventSchema, OperatorSchema } from "../../models/operator";
import { HOME_DEPOT_LOCATION } from "../../models/gpsLocation";

const validOperator = {
  operator_id: "01OPERATOR",
  name: "Truck 12",
  status: "ACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: null,
  rate_per_hour: 45,
  current_location: HOME_DEPOT_LOCATION,
  last_event_sequence: 0,
};

describe("OperatorSchema", () => {
  it("accepts a well-formed Operator", () => {
    expect(OperatorSchema.parse(validOperator)).toEqual(validOperator);
  });

  it("accepts a retired Operator (INACTIVE, end_datetime set)", () => {
    const retired = { ...validOperator, status: "INACTIVE", end_datetime: "2026-09-12T01:00:00.000Z" };
    expect(OperatorSchema.parse(retired)).toEqual(retired);
  });

  it("accepts a queued-for-removal Operator (removal_requested_at set, still ACTIVE)", () => {
    const queued = { ...validOperator, removal_requested_at: "2026-09-12T00:30:00.000Z" };
    expect(OperatorSchema.parse(queued)).toEqual(queued);
  });

  it("accepts a null current_location", () => {
    const noLocation = { ...validOperator, current_location: null };
    expect(OperatorSchema.parse(noLocation)).toEqual(noLocation);
  });

  it("rejects an unknown status value", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, status: "RETIRED" }).success).toBe(false);
  });

  it("rejects an unknown current_activity value", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, current_activity: "OFF_SHIFT" }).success).toBe(false);
  });

  it("rejects a non-positive rate_per_hour", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, rate_per_hour: 0 }).success).toBe(false);
    expect(OperatorSchema.safeParse({ ...validOperator, rate_per_hour: -5 }).success).toBe(false);
  });

  it("rejects a missing operator_id", () => {
    const withoutId: Record<string, unknown> = { ...validOperator };
    delete withoutId.operator_id;
    expect(OperatorSchema.safeParse(withoutId).success).toBe(false);
  });

  it("rejects an empty-string name", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, name: "" }).success).toBe(false);
  });
});

const validOperatorEvent = {
  operator_id: "01OPERATOR",
  sequence_number: 0,
  event_type: "OPERATOR_ADDED",
  payload: { rate_per_hour: 45 },
  occurred_at: "2026-09-12T00:00:00.000Z",
  actor: "ADMIN",
};

describe("OperatorEventSchema", () => {
  it("accepts a well-formed OperatorEvent", () => {
    expect(OperatorEventSchema.parse(validOperatorEvent)).toEqual(validOperatorEvent);
  });

  it("rejects an unknown event_type", () => {
    expect(OperatorEventSchema.safeParse({ ...validOperatorEvent, event_type: "BOGUS" }).success).toBe(false);
  });

  it("rejects an unknown actor", () => {
    expect(OperatorEventSchema.safeParse({ ...validOperatorEvent, actor: "PUBLIC" }).success).toBe(false);
  });

  it("rejects a negative sequence_number", () => {
    expect(OperatorEventSchema.safeParse({ ...validOperatorEvent, sequence_number: -1 }).success).toBe(false);
  });
});
