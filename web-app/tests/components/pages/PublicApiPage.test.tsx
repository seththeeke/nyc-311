import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PublicApiPage } from "../../../src/components/pages/PublicApiPage";

vi.mock("../../../src/components/publicApi/PublicApiHealth", () => ({ PublicApiHealth: () => <section>health</section> }));
vi.mock("../../../src/components/publicApi/PublicApiReference", () => ({ PublicApiReference: () => <section>reference</section> }));

describe("PublicApiPage", () => {
  it("puts the overview, health and reference under one heading, with a link back to Monitoring", () => {
    render(
      <MemoryRouter>
        <PublicApiPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Public API" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByRole("heading", { name: "Build on BoroughSim" })).toBeInTheDocument();
    expect(screen.getByText("health")).toBeInTheDocument();
    expect(screen.getByText("reference")).toBeInTheDocument();
  });
});
