import { describe, expect, it } from "vitest";
import { OrderExecutionTaskSchema, DispatchResultSchema } from "../../models/orderExecutionTask";

const JOB_LOCATION = { lat: 40.75, lng: -73.98 };

describe("OrderExecutionTaskSchema", () => {
  it("accepts a well-formed DISPATCH task", () => {
    const task = { phase: "DISPATCH", order_id: "01ORDER", operator_id: "01OPERATOR", job_location: JOB_LOCATION };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual(task);
  });

  it("accepts a well-formed ARRIVE task", () => {
    const task = { phase: "ARRIVE", order_id: "01ORDER", operator_id: "01OPERATOR", job_location: JOB_LOCATION };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual(task);
  });

  it("accepts a well-formed RESOLVE task carrying its actual materials cost", () => {
    const task = { phase: "RESOLVE", order_id: "01ORDER", operator_id: "01OPERATOR", materials_cost_actual: 112.5 };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual(task);
  });

  it("defaults a RESOLVE task's missing materials cost to null (an execution dispatched before it existed)", () => {
    const task = { phase: "RESOLVE", order_id: "01ORDER", operator_id: "01OPERATOR" };
    expect(OrderExecutionTaskSchema.parse(task)).toEqual({ ...task, materials_cost_actual: null });
  });

  it("rejects an unknown phase", () => {
    expect(OrderExecutionTaskSchema.safeParse({ phase: "PROCESS", order_id: "01ORDER" }).success).toBe(false);
  });

  it("rejects a DISPATCH task missing job_location", () => {
    expect(
      OrderExecutionTaskSchema.safeParse({
        phase: "DISPATCH",
        order_id: "01ORDER",
        operator_id: "01OPERATOR",
      }).success
    ).toBe(false);
  });
});

describe("DispatchResultSchema", () => {
  it("accepts well-formed wait durations and an actual materials cost", () => {
    const result = { transit_wait_seconds: 12, processing_wait_seconds: 18, materials_cost_actual: 112.5 };
    expect(DispatchResultSchema.parse(result)).toEqual(result);
  });

  it("rejects a negative wait duration", () => {
    expect(
      DispatchResultSchema.safeParse({ transit_wait_seconds: -1, processing_wait_seconds: 18, materials_cost_actual: 0 }).success
    ).toBe(false);
  });

  it("rejects a negative materials cost", () => {
    expect(
      DispatchResultSchema.safeParse({ transit_wait_seconds: 1, processing_wait_seconds: 18, materials_cost_actual: -1 }).success
    ).toBe(false);
  });
});
