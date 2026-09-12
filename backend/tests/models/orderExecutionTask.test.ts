import { describe, expect, it } from "vitest";
import { OrderExecutionTaskSchema, DispatchResultSchema } from "../../models/orderExecutionTask";

const JOB_LOCATION = { lat: 40.75, lng: -73.98 };

describe("OrderExecutionTaskSchema", () => {
  it("accepts a well-formed DISPATCH task", () => {
    const task = {
      phase: "DISPATCH",
      order_id: "01ORDER",
      operator_id: "01OPERATOR",
      job_location: JOB_LOCATION,
      transit_minutes: 20,
      processing_minutes: 30,
    };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual(task);
  });

  it("accepts a well-formed ARRIVE task", () => {
    const task = { phase: "ARRIVE", order_id: "01ORDER", operator_id: "01OPERATOR", job_location: JOB_LOCATION };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual(task);
  });

  it("accepts a well-formed RESOLVE task", () => {
    const task = { phase: "RESOLVE", order_id: "01ORDER", operator_id: "01OPERATOR" };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual(task);
  });

  it("rejects an unknown phase", () => {
    expect(OrderExecutionTaskSchema.safeParse({ phase: "PROCESS", order_id: "01ORDER" }).success).toBe(false);
  });

  it("rejects a DISPATCH task missing transit_minutes", () => {
    expect(
      OrderExecutionTaskSchema.safeParse({
        phase: "DISPATCH",
        order_id: "01ORDER",
        operator_id: "01OPERATOR",
        job_location: JOB_LOCATION,
        processing_minutes: 30,
      }).success
    ).toBe(false);
  });
});

describe("DispatchResultSchema", () => {
  it("accepts well-formed wait durations", () => {
    const result = { transit_wait_seconds: 12, processing_wait_seconds: 18 };
    expect(DispatchResultSchema.parse(result)).toEqual(result);
  });

  it("rejects a negative wait duration", () => {
    expect(DispatchResultSchema.safeParse({ transit_wait_seconds: -1, processing_wait_seconds: 18 }).success).toBe(false);
  });
});
