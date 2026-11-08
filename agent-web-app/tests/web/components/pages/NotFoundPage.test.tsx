import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { makeHealth, renderAt, stubApi } from "../../fixtures.tsx";

describe("NotFoundPage", () => {
  it("links back to the agents", async () => {
    stubApi({ "/health": makeHealth() });
    renderAt("/nope");
    expect(await screen.findByRole("link", { name: "Back to agents" })).toHaveAttribute("href", "/");
  });
});
