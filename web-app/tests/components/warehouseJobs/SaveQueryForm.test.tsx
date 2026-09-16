import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveQueryForm } from "../../../src/components/warehouseJobs/SaveQueryForm";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";

const savedQuery: WarehouseJobDefinition = {
  job_run_id: "DEF#top_five_zips",
  record_type: "DEFINITION",
  job_name: "top_five_zips",
  sql_s3_key: "job-definitions/top_five_zips.sql",
  job_type: "SAVED_QUERY",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

describe("SaveQueryForm", () => {
  it("disables Save query until the name is non-blank", async () => {
    render(<SaveQueryForm initialSql="SELECT 1" onCreate={vi.fn()} isCreating={false} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Save query" })).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText("Query name"), "top_five_zips");
    expect(screen.getByRole("button", { name: "Save query" })).toBeEnabled();
  });

  it("shows a validation error and does not call onCreate for an invalid name", async () => {
    const onCreate = vi.fn();
    render(<SaveQueryForm initialSql="SELECT 1" onCreate={onCreate} isCreating={false} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Query name"), "Top Five");
    await user.click(screen.getByRole("button", { name: "Save query" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Lowercase letters, digits, and underscores only.");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("calls onCreate with the trimmed name and the initial SQL, then onCreated", async () => {
    const onCreate = vi.fn().mockResolvedValue(savedQuery);
    const onCreated = vi.fn();
    render(<SaveQueryForm initialSql="SELECT 1" onCreate={onCreate} isCreating={false} error={null} onCreated={onCreated} onCancel={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Query name"), "  top_five_zips  ");
    await user.click(screen.getByRole("button", { name: "Save query" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("top_five_zips", "SELECT 1"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(savedQuery));
  });

  it("does not throw out of handleSubmit when onCreate rejects", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("already exists"));
    render(<SaveQueryForm initialSql="SELECT 1" onCreate={onCreate} isCreating={false} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Query name"), "top_five_zips");
    await user.click(screen.getByRole("button", { name: "Save query" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });

  it("disables and relabels the button while creating", () => {
    render(<SaveQueryForm initialSql="SELECT 1" onCreate={vi.fn()} isCreating={true} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("shows the error message when present", () => {
    render(
      <SaveQueryForm
        initialSql="SELECT 1"
        onCreate={vi.fn()}
        isCreating={false}
        error={new Error("already exists")}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<SaveQueryForm initialSql="SELECT 1" onCreate={vi.fn()} isCreating={false} error={null} onCreated={vi.fn()} onCancel={onCancel} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
