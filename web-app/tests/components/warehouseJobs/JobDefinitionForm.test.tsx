import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobDefinitionForm } from "../../../src/components/warehouseJobs/JobDefinitionForm";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";

const job: WarehouseJobDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION",
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  job_type: "SCHEDULED",
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

describe("JobDefinitionForm", () => {
  it("pre-fills the SQL textarea from initialSql", () => {
    render(
      <JobDefinitionForm
        initialSql="SELECT 1"
        onCreate={vi.fn()}
        isCreating={false}
        error={null}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByLabelText("SQL")).toHaveValue("SELECT 1");
  });

  it("disables Create job until both name and SQL are non-blank", async () => {
    render(<JobDefinitionForm onCreate={vi.fn()} isCreating={false} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Create job" })).toBeDisabled();
    await user.type(screen.getByLabelText("Job name"), "order_volume_by_zip");
    expect(screen.getByRole("button", { name: "Create job" })).toBeDisabled();
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    expect(screen.getByRole("button", { name: "Create job" })).toBeEnabled();
  });

  it("shows a validation error and does not call onCreate for an invalid job name", async () => {
    const onCreate = vi.fn();
    render(<JobDefinitionForm onCreate={onCreate} isCreating={false} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Job name"), "Order Volume");
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Lowercase letters, digits, and underscores only.");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("calls onCreate with the trimmed name, built cron expression, and SQL, then onCreated", async () => {
    const onCreate = vi.fn().mockResolvedValue(job);
    const onCreated = vi.fn();
    render(<JobDefinitionForm onCreate={onCreate} isCreating={false} error={null} onCreated={onCreated} onCancel={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Job name"), "order_volume_by_zip");
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("order_volume_by_zip", "SELECT 1", "cron(0 9 * * ? *)"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(job));
  });

  it("does not throw out of handleSubmit when onCreate rejects", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("already exists"));
    render(<JobDefinitionForm onCreate={onCreate} isCreating={false} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Job name"), "order_volume_by_zip");
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });

  it("disables and relabels the button while creating", () => {
    render(<JobDefinitionForm onCreate={vi.fn()} isCreating={true} error={null} onCreated={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("shows the error message when present", () => {
    render(
      <JobDefinitionForm onCreate={vi.fn()} isCreating={false} error={new Error("already exists")} onCreated={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<JobDefinitionForm onCreate={vi.fn()} isCreating={false} error={null} onCreated={vi.fn()} onCancel={onCancel} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
