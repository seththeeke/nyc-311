import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CityHud } from "../../../src/components/mapv2/CityHud";
import { IDLE_OPERATOR, WORKING_OPERATOR } from "./fixtures";

describe("CityHud", () => {
  it("counts the fleet by activity and shows it's live", () => {
    render(<CityHud operators={[IDLE_OPERATOR, WORKING_OPERATOR, { ...IDLE_OPERATOR, operator_id: "2" }]} isLoading={false} error={null} yieldWhenNarrow={false} />);
    expect(screen.getByRole("heading", { name: "NYC Fleet · 3-D" })).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    const counts = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(counts).toEqual(["Idle2", "In transit0", "Working1"]);
    expect(screen.getByRole("region", { name: "Fleet summary" })).not.toHaveClass("@max-3xl:hidden");
  });

  it("shows loading and errors, and yields in a narrow workspace when asked", () => {
    render(<CityHud operators={[]} isLoading error={new Error("boom")} yieldWhenNarrow />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the fleet: boom");
    expect(screen.getByRole("region", { name: "Fleet summary" })).toHaveClass("@max-3xl:hidden");
  });
});
