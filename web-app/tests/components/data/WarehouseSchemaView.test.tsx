import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarehouseSchemaView } from "../../../src/components/data/WarehouseSchemaView";
import type { WarehouseTable } from "../../../src/models/warehouseSchema";

const orderEvents: WarehouseTable = {
  table_name: "order_events",
  columns: [
    { name: "order_id", type: "string", comment: null },
    { name: "payload", type: "string", comment: "Opaque JSON — parse with json_extract." },
  ],
};

const requests: WarehouseTable = {
  table_name: "requests",
  columns: [{ name: "request_id", type: "string", comment: null }],
};

describe("WarehouseSchemaView", () => {
  it("renders one section per table, named and with a column count", () => {
    render(<WarehouseSchemaView tables={[orderEvents, requests]} />);

    expect(screen.getByText("order_events")).toBeInTheDocument();
    expect(screen.getByText("(2 columns)")).toBeInTheDocument();
    expect(screen.getByText("requests")).toBeInTheDocument();
    expect(screen.getByText("(1 columns)")).toBeInTheDocument();
  });

  it("renders every column's name, type, and comment", () => {
    render(<WarehouseSchemaView tables={[orderEvents]} />);

    expect(screen.getByText("order_id")).toBeInTheDocument();
    expect(screen.getByText("payload")).toBeInTheDocument();
    expect(screen.getAllByText("string")).toHaveLength(2);
    expect(screen.getByText("Opaque JSON — parse with json_extract.")).toBeInTheDocument();
  });

  it("renders each table's schema collapsed by default (the column list is opt-in)", () => {
    render(<WarehouseSchemaView tables={[orderEvents]} />);

    const details = screen.getByText("order_events").closest("details");
    expect(details).not.toHaveAttribute("open");
  });

  it("renders no sections for an empty catalog", () => {
    render(<WarehouseSchemaView tables={[]} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
