import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureGate } from "../../../src/components/shell/FeatureGate";
import { useFeatureEnabled } from "../../../src/hooks/useFeatureTreatment";

vi.mock("../../../src/hooks/useFeatureTreatment", () => ({ useFeatureEnabled: vi.fn() }));

describe("FeatureGate", () => {
  it("renders its children only while the flag is on", () => {
    vi.mocked(useFeatureEnabled).mockReturnValue(true);
    const { rerender } = render(
      <FeatureGate flagKey="CUSTOMERS_TAB" onTreatment="T1">
        <p>Residents</p>
      </FeatureGate>,
    );
    expect(screen.getByText("Residents")).toBeInTheDocument();
    expect(useFeatureEnabled).toHaveBeenCalledWith("CUSTOMERS_TAB", "T1");

    vi.mocked(useFeatureEnabled).mockReturnValue(false);
    rerender(
      <FeatureGate flagKey="CUSTOMERS_TAB" onTreatment="T1">
        <p>Residents</p>
      </FeatureGate>,
    );
    expect(screen.queryByText("Residents")).not.toBeInTheDocument();
  });
});
