import { describe, expect, it } from "vitest";
import { RouteReportEntrySchema, IntegrationTestReportSchema } from "../../src/models/integrationTestReport";

const validEntry = { hit: true, statusCode: 200, ok: true };
const validReport = {
  target: "test",
  ranAt: "2026-08-24T12:00:00.000Z",
  routes: { "/orders": validEntry },
};

describe("RouteReportEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    expect(RouteReportEntrySchema.parse(validEntry)).toEqual(validEntry);
  });

  it("accepts a not-hit entry with a null statusCode", () => {
    const notHit = { hit: false, statusCode: null, ok: false };
    expect(RouteReportEntrySchema.safeParse(notHit).success).toBe(true);
  });

  it("rejects a missing hit field", () => {
    const withoutHit: Record<string, unknown> = { ...validEntry };
    delete withoutHit.hit;
    expect(RouteReportEntrySchema.safeParse(withoutHit).success).toBe(false);
  });
});

describe("IntegrationTestReportSchema", () => {
  it("accepts a well-formed report", () => {
    expect(IntegrationTestReportSchema.parse(validReport)).toEqual(validReport);
  });

  it("accepts an empty routes object", () => {
    expect(IntegrationTestReportSchema.safeParse({ ...validReport, routes: {} }).success).toBe(true);
  });

  it("rejects a report missing target", () => {
    const withoutTarget: Record<string, unknown> = { ...validReport };
    delete withoutTarget.target;
    expect(IntegrationTestReportSchema.safeParse(withoutTarget).success).toBe(false);
  });
});
