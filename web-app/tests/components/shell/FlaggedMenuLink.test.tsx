import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlaggedMenuLink } from "../../../src/components/shell/FlaggedMenuLink";
import { MENU, type MenuFlagRule, type MenuLinkEntry } from "../../../src/components/shell/menuConfig";
import { useFeatureTreatment } from "../../../src/hooks/useFeatureTreatment";

vi.mock("../../../src/hooks/useFeatureTreatment", () => ({ useFeatureTreatment: vi.fn() }));

const mapV2 = MENU.find((e): e is MenuLinkEntry & { featureFlag: MenuFlagRule } => e.kind === "LINK" && e.id === "MAP_V2")!;

function renderWith(treatment: string | null) {
  vi.mocked(useFeatureTreatment).mockReturnValue({ treatment, isLoading: false });
  return render(
    <ul>
      <FlaggedMenuLink entry={mapV2} render={(entry) => <span>{entry.label}</span>} />
    </ul>
  );
}

describe("FlaggedMenuLink", () => {
  it("renders the link as its flag resolves it", () => {
    renderWith("T2");
    expect(screen.getByRole("listitem")).toHaveTextContent("Map");
    expect(useFeatureTreatment).toHaveBeenCalledWith("MAP_V2");
  });

  it("renders nothing when its flag hides it", () => {
    renderWith(null);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
