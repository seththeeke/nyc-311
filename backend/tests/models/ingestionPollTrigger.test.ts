import { describe, expect, it } from "vitest";
import { IngestionPollTriggerSchema } from "../../models/ingestionPollTrigger";

describe("IngestionPollTriggerSchema", () => {
  it("accepts an empty object (the Scheduler's default configured Input)", () => {
    expect(IngestionPollTriggerSchema.safeParse({}).success).toBe(true);
  });

  it("accepts an object with arbitrary keys", () => {
    expect(IngestionPollTriggerSchema.safeParse({ note: "manual test invoke" }).success).toBe(true);
  });

  it("rejects a non-object payload", () => {
    expect(IngestionPollTriggerSchema.safeParse("not-an-object").success).toBe(false);
    expect(IngestionPollTriggerSchema.safeParse(null).success).toBe(false);
    expect(IngestionPollTriggerSchema.safeParse(42).success).toBe(false);
  });
});
