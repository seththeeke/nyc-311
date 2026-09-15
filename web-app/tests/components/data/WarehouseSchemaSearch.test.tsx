import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarehouseSchemaSearch } from "../../../src/components/data/WarehouseSchemaSearch";
import type { WarehouseTable } from "../../../src/models/warehouseSchema";

const orderEvents: WarehouseTable = {
  table_name: "order_events",
  columns: [
    { name: "order_id", type: "string", comment: null },
    { name: "payload", type: "string", comment: null },
  ],
};

const requests: WarehouseTable = {
  table_name: "requests",
  columns: [{ name: "request_id", type: "string", comment: null }],
};

describe("WarehouseSchemaSearch", () => {
  it("shows every table when the search box is empty", () => {
    render(<WarehouseSchemaSearch tables={[orderEvents, requests]} />);

    expect(screen.getByText("order_events")).toBeInTheDocument();
    expect(screen.getByText("requests")).toBeInTheDocument();
  });

  it("filters to tables whose name matches, keeping every column", async () => {
    render(<WarehouseSchemaSearch tables={[orderEvents, requests]} />);

    await userEvent.setup().type(screen.getByLabelText("Search schema"), "order_events");

    expect(screen.getByText("order_events")).toBeInTheDocument();
    expect(screen.getByText("(2 columns)")).toBeInTheDocument();
    expect(screen.queryByText("requests")).not.toBeInTheDocument();
  });

  it("filters to tables with a matching column, narrowing to just that column", async () => {
    render(<WarehouseSchemaSearch tables={[orderEvents, requests]} />);

    await userEvent.setup().type(screen.getByLabelText("Search schema"), "payload");

    expect(screen.getByText("order_events")).toBeInTheDocument();
    expect(screen.getByText("(1 columns)")).toBeInTheDocument();
    expect(screen.queryByText("requests")).not.toBeInTheDocument();
  });

  it("is case-insensitive", async () => {
    render(<WarehouseSchemaSearch tables={[orderEvents, requests]} />);

    await userEvent.setup().type(screen.getByLabelText("Search schema"), "REQUESTS");

    expect(screen.getByText("requests")).toBeInTheDocument();
    expect(screen.queryByText("order_events")).not.toBeInTheDocument();
  });

  it("shows a no-match message when nothing matches", async () => {
    render(<WarehouseSchemaSearch tables={[orderEvents, requests]} />);

    await userEvent.setup().type(screen.getByLabelText("Search schema"), "nonexistent");

    expect(screen.getByText('No tables or columns match "nonexistent".')).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
