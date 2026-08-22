import { describe, expect, it } from "vitest";
import {
  LambdaHealthPointSchema,
  LambdaHealthSchema,
  LambdaMetricsResponseSchema,
} from "../../src/models/lambdaMetrics";

const validPoint = { date: "2026-08-21", invocations: 4, errors: 0, successes: 4 };
const validLambda = { logicalName: "Poller", functionName: "Nyc311Poller-Test", points: [validPoint] };

describe("LambdaHealthPointSchema", () => {
  it("accepts a well-formed point", () => {
    expect(LambdaHealthPointSchema.parse(validPoint)).toEqual(validPoint);
  });

  it("accepts errors == invocations with successes 0 (the fan-out incident's shape)", () => {
    const stalled = { date: "2026-08-19", invocations: 1008, errors: 1008, successes: 0 };
    expect(LambdaHealthPointSchema.safeParse(stalled).success).toBe(true);
  });

  it("rejects a negative invocations count", () => {
    expect(LambdaHealthPointSchema.safeParse({ ...validPoint, invocations: -1 }).success).toBe(false);
  });

  it("rejects a missing date", () => {
    const withoutDate: Record<string, unknown> = { ...validPoint };
    delete withoutDate.date;
    expect(LambdaHealthPointSchema.safeParse(withoutDate).success).toBe(false);
  });
});

describe("LambdaHealthSchema", () => {
  it("accepts a well-formed Lambda entry", () => {
    expect(LambdaHealthSchema.parse(validLambda)).toEqual(validLambda);
  });

  it("accepts an empty points array", () => {
    expect(LambdaHealthSchema.safeParse({ ...validLambda, points: [] }).success).toBe(true);
  });

  it("rejects a missing functionName", () => {
    const withoutFunctionName: Record<string, unknown> = { ...validLambda };
    delete withoutFunctionName.functionName;
    expect(LambdaHealthSchema.safeParse(withoutFunctionName).success).toBe(false);
  });
});

describe("LambdaMetricsResponseSchema", () => {
  it("accepts a well-formed response envelope", () => {
    const response = { lambdas: [validLambda] };
    expect(LambdaMetricsResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty lambdas array", () => {
    expect(LambdaMetricsResponseSchema.parse({ lambdas: [] })).toEqual({ lambdas: [] });
  });

  it("rejects a response missing the lambdas array", () => {
    expect(LambdaMetricsResponseSchema.safeParse({}).success).toBe(false);
  });
});
