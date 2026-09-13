import { describe, expect, it } from "vitest";
import { buildCronExpression, describeCron, DEFAULT_CRON_PRESET } from "../../src/models/cronSchedule";

describe("buildCronExpression", () => {
  it("builds a daily expression from hour/minute", () => {
    expect(buildCronExpression({ ...DEFAULT_CRON_PRESET, kind: "daily", hour: 9, minute: 0 })).toBe(
      "cron(0 9 * * ? *)"
    );
  });

  it("builds an hourly expression from minute", () => {
    expect(buildCronExpression({ ...DEFAULT_CRON_PRESET, kind: "hourly", minute: 15 })).toBe("cron(15 * * * ? *)");
  });

  it("builds a weekly expression from day/hour/minute", () => {
    expect(
      buildCronExpression({ ...DEFAULT_CRON_PRESET, kind: "weekly", hour: 14, minute: 30, dayOfWeek: "MON" })
    ).toBe("cron(30 14 ? * MON *)");
  });

  it("passes a custom raw expression through, trimmed", () => {
    expect(buildCronExpression({ ...DEFAULT_CRON_PRESET, kind: "custom", raw: "  cron(0 0 * * ? *)  " })).toBe(
      "cron(0 0 * * ? *)"
    );
  });
});

describe("describeCron", () => {
  it("describes a daily cron", () => {
    expect(describeCron("cron(0 9 * * ? *)")).toBe("Daily at 09:00 UTC");
  });

  it("describes an hourly cron", () => {
    expect(describeCron("cron(15 * * * ? *)")).toBe("Hourly at :15");
  });

  it("describes a weekly cron", () => {
    expect(describeCron("cron(30 14 ? * MON *)")).toBe("Weekly on Monday at 14:30 UTC");
  });

  it("falls back to the raw string for a shape no preset produces", () => {
    expect(describeCron("cron(0/5 * * * ? *)")).toBe("cron(0/5 * * * ? *)");
  });

  it("falls back to the raw string for a malformed expression", () => {
    expect(describeCron("not a cron")).toBe("not a cron");
  });
});
