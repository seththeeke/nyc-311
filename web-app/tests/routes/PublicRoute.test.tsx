import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicRoute } from "../../src/routes/PublicRoute";

describe("PublicRoute", () => {
  it("renders its children unchanged", () => {
    render(
      <PublicRoute>
        <p>protected-ish content</p>
      </PublicRoute>
    );

    expect(screen.getByText("protected-ish content")).toBeInTheDocument();
  });
});
