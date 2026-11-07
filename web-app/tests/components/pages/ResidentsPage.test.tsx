import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResidentsPage } from "../../../src/components/pages/ResidentsPage";

vi.mock("../../../src/components/residents/IdeaFeed", () => ({ IdeaFeed: () => <p>idea feed</p> }));

describe("ResidentsPage", () => {
  it("titles the page Residents with the one-line description, no preview badge, and the idea feed", () => {
    render(<ResidentsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Residents" })).toBeInTheDocument();
    expect(screen.getByText("Simulated residents, backed by LLMs requesting support ideas to the system for the simulation to address.")).toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    expect(screen.getByText("idea feed")).toBeInTheDocument();
  });
});
