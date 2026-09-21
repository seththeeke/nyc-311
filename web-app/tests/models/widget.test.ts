import { describe, expect, it } from "vitest";
import { WIDGET_IDS, WidgetIdSchema, WidgetSizeSchema, WidgetStatusSchema } from "../../src/models/widget";

describe("widget schemas", () => {
  it("accepts every declared id, size, and status", () => {
    for (const id of WIDGET_IDS) expect(WidgetIdSchema.parse(id)).toBe(id);
    for (const size of ["TILE", "PANEL", "FULL"]) expect(WidgetSizeSchema.parse(size)).toBe(size);
    for (const status of ["LIVE", "WORK_IN_PROGRESS"]) expect(WidgetStatusSchema.parse(status)).toBe(status);
  });

  it("rejects unknown values and non-ALL_CAPS forms", () => {
    expect(WidgetIdSchema.safeParse("capacity").success).toBe(false);
    expect(WidgetSizeSchema.safeParse("HUGE").success).toBe(false);
    expect(WidgetStatusSchema.safeParse("wip").success).toBe(false);
  });
});
