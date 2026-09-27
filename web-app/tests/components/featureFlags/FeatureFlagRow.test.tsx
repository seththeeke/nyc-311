import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureFlagRow } from "../../../src/components/featureFlags/FeatureFlagRow";
import { MOCK_FEATURE_FLAGS } from "../../../src/test-data/featureFlags";

const [costModel, failureInjection] = MOCK_FEATURE_FLAGS;
const handlers = { onCreate: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn() };

describe("FeatureFlagRow", () => {
  it("summarizes a collapsed flag and toggles on click", async () => {
    const onToggle = vi.fn();
    render(<FeatureFlagRow flag={costModel} expanded={false} onToggle={onToggle} {...handlers} />);
    const summary = screen.getByRole("button", { expanded: false });
    expect(summary).toHaveTextContent("COST_MODEL");
    expect(summary).toHaveTextContent("default BRUTE_FORCE");
    expect(summary).toHaveTextContent("1 override");
    expect(summary).toHaveTextContent("split ML 10%");
    expect(summary).toHaveTextContent("v3");
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
    await userEvent.setup().click(summary);
    expect(onToggle).toHaveBeenCalled();
  });

  it("pluralizes overrides and shows the editor when expanded", () => {
    render(<FeatureFlagRow flag={failureInjection} expanded onToggle={vi.fn()} {...handlers} />);
    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("0 overrides");
    expect(screen.getByLabelText("Description")).toHaveValue(failureInjection.description);
  });
});
