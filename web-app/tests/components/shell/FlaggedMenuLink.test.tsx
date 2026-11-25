import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlaggedMenuLink } from "../../../src/components/shell/FlaggedMenuLink";
import { MENU, type MenuFlagRule, type MenuLinkEntry } from "../../../src/components/shell/menuConfig";
import { useFeatureTreatment } from "../../../src/hooks/useFeatureTreatment";

vi.mock("../../../src/hooks/useFeatureTreatment", () => ({ useFeatureTreatment: vi.fn() }));

const contacts = MENU.find((e): e is MenuLinkEntry & { featureFlag: MenuFlagRule } => e.kind === "LINK" && e.id === "CONTACTS")!;

function renderWith(treatment: string | null) {
  vi.mocked(useFeatureTreatment).mockReturnValue({ treatment, isLoading: false });
  return render(
    <ul>
      <FlaggedMenuLink entry={contacts} render={(entry) => <span>{entry.label}</span>} />
    </ul>
  );
}

describe("FlaggedMenuLink", () => {
  it("renders the link as its flag resolves it", () => {
    renderWith("T1");
    expect(screen.getByRole("listitem")).toHaveTextContent("Contacts");
    expect(useFeatureTreatment).toHaveBeenCalledWith("CONTACTS_PAGE");
  });

  it("renders nothing when its flag hides it", () => {
    renderWith(null);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
