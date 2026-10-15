import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomersPage } from "../../../src/components/pages/CustomersPage";

vi.mock("../../../src/components/customers/IdeaFeed", () => ({ IdeaFeed: () => <p>idea feed</p> }));

describe("CustomersPage", () => {
  it("titles the page, marks it as a preview, and renders the idea feed", () => {
    render(<CustomersPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Customers" })).toBeInTheDocument();
    expect(screen.getByText("PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("idea feed")).toBeInTheDocument();
  });
});
