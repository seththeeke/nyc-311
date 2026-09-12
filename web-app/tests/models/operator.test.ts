import { describe, expect, it } from "vitest";
import { CapacityStatusSchema, OperatorSchema } from "../../src/models/operator";

const validOperator = {
  operator_id: "01OPERATOR",
  name: "Truck 12",
  status: "ACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: null,
  rate_per_hour: 45,
  last_event_sequence: 0,
};

describe("OperatorSchema", () => {
  it("accepts a well-formed Operator", () => {
    expect(OperatorSchema.parse(validOperator)).toEqual(validOperator);
  });

  it("rejects an unknown status value", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, status: "RETIRED" }).success).toBe(false);
  });

  it("rejects an unknown current_activity value", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, current_activity: "OFF_SHIFT" }).success).toBe(false);
  });

  it("rejects a non-positive rate_per_hour", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, rate_per_hour: 0 }).success).toBe(false);
  });

  it("rejects an empty-string name", () => {
    expect(OperatorSchema.safeParse({ ...validOperator, name: "" }).success).toBe(false);
  });
});

describe("CapacityStatusSchema", () => {
  it("accepts a well-formed CapacityStatus", () => {
    const status = { available_count: 1, fleet_size: 1, hourly_burn_rate: 45, roster: [validOperator] };
    expect(CapacityStatusSchema.parse(status)).toEqual(status);
  });

  it("accepts an empty roster", () => {
    const status = { available_count: 0, fleet_size: 0, hourly_burn_rate: 0, roster: [] };
    expect(CapacityStatusSchema.parse(status)).toEqual(status);
  });

  it("rejects a negative fleet_size", () => {
    const status = { available_count: 0, fleet_size: -1, hourly_burn_rate: 0, roster: [] };
    expect(CapacityStatusSchema.safeParse(status).success).toBe(false);
  });
});
