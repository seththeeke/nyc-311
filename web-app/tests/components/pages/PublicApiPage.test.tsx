import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PublicApiPage } from "../../../src/components/pages/PublicApiPage";

vi.mock("../../../src/components/publicApi/PublicApiHealth", () => ({ PublicApiHealth: () => <section>health</section> }));
vi.mock("../../../src/components/publicApi/PublicApiSpecDownload", () => ({ PublicApiSpecDownload: () => <section>download</section> }));

describe("PublicApiPage", () => {
  it("leads with health, then the operations, then the spec download", () => {
    render(
      <MemoryRouter>
        <PublicApiPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Public API" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    const text = document.body.textContent ?? "";
    expect(text.indexOf("health")).toBeLessThan(text.indexOf("Operations"));
    expect(text.indexOf("Operations")).toBeLessThan(text.indexOf("download"));
  });
});
