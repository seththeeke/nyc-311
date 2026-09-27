import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureFlagEditor } from "../../../src/components/featureFlags/FeatureFlagEditor";
import { MOCK_FEATURE_FLAGS } from "../../../src/test-data/featureFlags";

const flag = MOCK_FEATURE_FLAGS[0];

function renderEditor(overrides: Partial<Parameters<typeof FeatureFlagEditor>[0]> = {}) {
  const props = {
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<FeatureFlagEditor {...props} />);
  return props;
}

describe("FeatureFlagEditor — existing flag", () => {
  it("saves the whole config with the version it was loaded at, staying open", async () => {
    const props = renderEditor({ flag });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "changed" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(props.onUpdate).toHaveBeenCalledWith("COST_MODEL", {
      description: "changed",
      treatments: ["BRUTE_FORCE", "ML"],
      default_treatment: "BRUTE_FORCE",
      overrides: flag.overrides,
      allocations: flag.allocations,
      expected_version: 3,
    });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Flag key")).not.toBeInTheDocument();
  });

  it("shows validation problems and disables save", () => {
    renderEditor({ flag });
    fireEvent.change(screen.getByLabelText("Treatments (comma-separated)"), { target: { value: "ml" } });
    expect(screen.getByLabelText("COST_MODEL validation problems")).toHaveTextContent("Default must be one of the treatments");
    expect(screen.getByRole("option", { name: "Pick one…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("changes the default treatment", () => {
    renderEditor({ flag });
    fireEvent.change(screen.getByLabelText("Default treatment"), { target: { value: "ML" } });
    expect(screen.getByLabelText("Default treatment")).toHaveValue("ML");
  });

  it("surfaces a save failure (e.g. a stale version)", async () => {
    renderEditor({ flag, onUpdate: vi.fn().mockRejectedValue(new Error("reload and retry")) });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("reload and retry");
  });

  it("stringifies a non-Error failure", async () => {
    renderEditor({ flag, onUpdate: vi.fn().mockRejectedValue("nope") });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
  });

  it("requires a second click to delete, then closes", async () => {
    const props = renderEditor({ flag });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete COST_MODEL" }));
    expect(props.onDelete).toHaveBeenCalledWith("COST_MODEL");
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("closes without saving", async () => {
    const props = renderEditor({ flag });
    await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onUpdate).not.toHaveBeenCalled();
  });
});

describe("FeatureFlagEditor — new flag", () => {
  it("creates with an upper-cased key and closes on success", async () => {
    const props = renderEditor();
    expect(screen.getByRole("button", { name: "Create flag" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Flag key"), { target: { value: "new_flag" } });
    fireEvent.change(screen.getByLabelText("Treatments (comma-separated)"), { target: { value: "on, off" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Create flag" }));
    expect(props.onCreate).toHaveBeenCalledWith({
      flag_key: "NEW_FLAG",
      description: "",
      treatments: ["ON", "OFF"],
      default_treatment: "OFF",
      overrides: [],
      allocations: [],
    });
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("wires the overrides and allocations editors into the draft", async () => {
    renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Add override" }));
    await user.click(screen.getByRole("button", { name: "+ Add split" }));
    expect(screen.getByLabelText("new flag override 1 entity id")).toBeInTheDocument();
    expect(screen.getByText("Default (OFF) gets 90%")).toBeInTheDocument();
  });

  it("offers Discard instead of Close", async () => {
    const props = renderEditor();
    await userEvent.setup().click(screen.getByRole("button", { name: "Discard" }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
