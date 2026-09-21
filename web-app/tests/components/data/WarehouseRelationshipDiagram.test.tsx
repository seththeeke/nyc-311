import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarehouseRelationshipDiagram } from "../../../src/components/data/WarehouseRelationshipDiagram";
import { LIVE_TABLES } from "../../testUtils/warehouseTables";

describe("WarehouseRelationshipDiagram", () => {
  it("renders a labelled diagram with one box per table and one arrow per relationship", () => {
    const { container } = render(<WarehouseRelationshipDiagram tables={LIVE_TABLES} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Relationship diagram: 6 tables, 6 foreign-key relationships");
    for (const table of LIVE_TABLES) expect(container.querySelector("svg")).toHaveTextContent(table.table_name);
    expect(container.querySelectorAll("svg path[marker-end]")).toHaveLength(6);
  });

  it("exposes the relationships as text for screen readers", () => {
    render(<WarehouseRelationshipDiagram tables={LIVE_TABLES} />);
    const list = screen.getByRole("list", { name: "Foreign-key relationships" });
    const items = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toHaveLength(6);
    expect(items).toContain("order_events.order_id references order_snapshots.order_id");
    expect(items).toContain("order_snapshots.assigned_operator_id references operator_snapshots.operator_id");
  });

  it("labels primary and foreign key columns", () => {
    const { container } = render(<WarehouseRelationshipDiagram tables={LIVE_TABLES} />);
    const svgText = container.querySelector("svg")!.textContent!;
    expect(svgText).toContain("PK");
    expect(svgText).toContain("FK");
  });

  it("starts in key-columns-only mode and toggles to all columns and back", async () => {
    const { container } = render(<WarehouseRelationshipDiagram tables={LIVE_TABLES} />);
    const user = userEvent.setup();
    const svg = () => container.querySelector("svg")!;
    const toggle = screen.getByRole("button", { name: "Show all columns" });

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(svg()).not.toHaveTextContent("complaint_type");
    expect(svg()).toHaveTextContent("+ 3 other columns");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Key columns only" })).toHaveAttribute("aria-pressed", "true");
    expect(svg()).toHaveTextContent("complaint_type");
    expect(svg()).not.toHaveTextContent("other column");

    await user.click(screen.getByRole("button", { name: "Key columns only" }));
    expect(svg()).not.toHaveTextContent("complaint_type");
  });

  it("uses singular wording for a single hidden column", () => {
    const tables = [
      { table_name: "locations", columns: [{ name: "location_id", type: "string", comment: null }, { name: "bbl", type: "string", comment: null }] },
      { table_name: "requests", columns: [{ name: "request_id", type: "string", comment: null }, { name: "location_id", type: "string", comment: null }] },
    ];
    const { container } = render(<WarehouseRelationshipDiagram tables={tables} />);
    expect(container.querySelector("svg")).toHaveTextContent("+ 1 other column");
    expect(container.querySelector("svg")).not.toHaveTextContent("other columns");
  });

  it("explains that foreign keys are inferred, not declared", () => {
    render(<WarehouseRelationshipDiagram tables={LIVE_TABLES} />);
    expect(screen.getByText(/inferred from/)).toHaveTextContent("the catalog doesn't declare them");
  });

  it("shows a message instead of an empty diagram when nothing relates", () => {
    render(<WarehouseRelationshipDiagram tables={[LIVE_TABLES[3]]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/No foreign-key relationships could be inferred/)).toBeInTheDocument();
  });
});
