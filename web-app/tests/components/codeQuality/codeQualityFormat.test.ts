import { describe, expect, it } from "vitest";
import { formatChange, formatRun, latestByPackage, reportId } from "../../../src/components/codeQuality/codeQualityFormat";
import { MOCK_CODE_QUALITY_REPORTS } from "../../../src/test-data/codeQualityReports";

describe("codeQualityFormat", () => {
  it("formats a run's folder as its CT start", () => {
    expect(formatRun("2026-11-09", "23_30")).toBe("Nov 9, 2026 · 23:30 CT");
    expect(reportId({ date: "2026-11-09", time: "23_30" })).toBe("2026-11-09/23_30");
  });

  it("says the change in words and arrows, not colour", () => {
    expect(formatChange(64, 58)).toBe("↑ 6");
    expect(formatChange(55, 58)).toBe("↓ 3");
    expect(formatChange(58, 58)).toBe("no change");
    expect(formatChange(70, null)).toBe("first audit");
    expect(formatChange(null, 58)).toBe("no score");
  });

  it("keeps each package's newest report", () => {
    expect(latestByPackage(MOCK_CODE_QUALITY_REPORTS).map((r) => [r.package, r.date])).toEqual([
      ["backend", "2026-11-09"],
      ["web-app", "2026-11-05"],
    ]);
  });
});
