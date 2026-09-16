import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavedQueriesList } from "../../../src/components/data/SavedQueriesList";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";

const queryA: WarehouseJobDefinition = {
  job_run_id: "DEF#top_five_zips",
  record_type: "DEFINITION",
  job_name: "top_five_zips",
  sql_s3_key: "job-definitions/top_five_zips.sql",
  job_type: "SAVED_QUERY",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

const queryB: WarehouseJobDefinition = { ...queryA, job_run_id: "DEF#scratchpad", job_name: "scratchpad" };

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

describe("SavedQueriesList", () => {
  it("shows a placeholder when there are no saved queries", () => {
    render(<SavedQueriesList queries={[]} onDelete={vi.fn()} isDeleting={false} deleteError={null} onLoad={vi.fn()} loadingName={null} />);

    expect(screen.getByText(/No saved queries yet/)).toBeInTheDocument();
  });

  it("renders one row per saved query with a saved-date subtext", () => {
    render(
      <SavedQueriesList queries={[queryA, queryB]} onDelete={vi.fn()} isDeleting={false} deleteError={null} onLoad={vi.fn()} loadingName={null} />
    );

    expect(screen.getByText("top_five_zips")).toBeInTheDocument();
    expect(screen.getByText("scratchpad")).toBeInTheDocument();
    expect(screen.getAllByText(/^Saved /)).toHaveLength(2);
  });

  it("calls onLoad with the query when its Load button is clicked", async () => {
    const onLoad = vi.fn();
    render(
      <SavedQueriesList queries={[queryA, queryB]} onDelete={vi.fn()} isDeleting={false} deleteError={null} onLoad={onLoad} loadingName={null} />
    );

    await userEvent.setup().click(within(rowFor("scratchpad")).getByRole("button", { name: "Load query scratchpad" }));

    expect(onLoad).toHaveBeenCalledWith(queryB);
  });

  it("disables and relabels only the loading query's own Load button", () => {
    render(
      <SavedQueriesList
        queries={[queryA, queryB]}
        onDelete={vi.fn()}
        isDeleting={false}
        deleteError={null}
        onLoad={vi.fn()}
        loadingName="top_five_zips"
      />
    );

    expect(within(rowFor("top_five_zips")).getByRole("button", { name: "Loading top_five_zips" })).toBeDisabled();
    expect(within(rowFor("scratchpad")).getByRole("button", { name: "Load query scratchpad" })).toBeEnabled();
  });

  it("requires confirmation before deleting, and calls onDelete on confirm", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <SavedQueriesList queries={[queryA]} onDelete={onDelete} isDeleting={false} deleteError={null} onLoad={vi.fn()} loadingName={null} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete query top_five_zips" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete top_five_zips?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("top_five_zips"));
  });

  it("cancels the delete confirmation without calling onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <SavedQueriesList queries={[queryA]} onDelete={onDelete} isDeleting={false} deleteError={null} onLoad={vi.fn()} loadingName={null} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete query top_five_zips" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete top_five_zips?")).not.toBeInTheDocument();
  });

  it("does not throw out of the confirm handler when onDelete rejects", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("boom"));
    render(
      <SavedQueriesList queries={[queryA]} onDelete={onDelete} isDeleting={false} deleteError={null} onLoad={vi.fn()} loadingName={null} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete query top_five_zips" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });

  it("disables Confirm and relabels it while deleting", async () => {
    render(
      <SavedQueriesList queries={[queryA]} onDelete={vi.fn()} isDeleting={true} deleteError={null} onLoad={vi.fn()} loadingName={null} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete query top_five_zips" }));

    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("shows the delete error message when present", () => {
    render(
      <SavedQueriesList
        queries={[queryA]}
        onDelete={vi.fn()}
        isDeleting={false}
        deleteError={new Error("boom")}
        onLoad={vi.fn()}
        loadingName={null}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });
});
