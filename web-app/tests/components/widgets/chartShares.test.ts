import { describe, expect, it } from "vitest";
import { describeShares, SERIES_COLORS, toShares } from "../../../src/components/widgets/chartShares";

describe("toShares", () => {
  it("normalizes values to percentages that sum to 100", () => {
    const shares = toShares([{ label: "A", value: 1 }, { label: "B", value: 3 }]);
    expect(shares.map((s) => s.percent)).toEqual([25, 75]);
  });

  it("assigns the categorical colours by position, in fixed order", () => {
    const shares = toShares([{ label: "A", value: 1 }, { label: "B", value: 1 }, { label: "C", value: 1 }, { label: "D", value: 1 }]);
    expect(shares.map((s) => s.color)).toEqual([...SERIES_COLORS]);
  });

  it("wraps colours past the fourth series rather than failing", () => {
    const shares = toShares(Array.from({ length: 5 }, (_, i) => ({ label: `L${i}`, value: 1 })));
    expect(shares[4].color).toBe(SERIES_COLORS[0]);
  });

  it("gives 0% shares, not NaN, when everything is zero", () => {
    expect(toShares([{ label: "A", value: 0 }]).map((s) => s.percent)).toEqual([0]);
    expect(toShares([])).toEqual([]);
  });
});

describe("describeShares", () => {
  it("reads as a comma-separated rounded list", () => {
    expect(describeShares(toShares([{ label: "Done", value: 2 }, { label: "Open", value: 1 }]))).toBe("Done 67%, Open 33%");
  });
});
