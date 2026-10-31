import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicApiOverview } from "../../../src/components/publicApi/PublicApiOverview";
import { PUBLIC_API_OPERATIONS } from "../../../src/components/publicApi/publicApiOperations";

describe("PublicApiOverview", () => {
  it("pitches the API with its base URL and one card per operation, each with a curl example", () => {
    render(<PublicApiOverview baseUrl="https://public-api.example.com" />);

    expect(screen.getByRole("heading", { name: "Build on BoroughSim" })).toBeInTheDocument();
    expect(screen.getByText("https://public-api.example.com")).toBeInTheDocument();
    for (const operation of PUBLIC_API_OPERATIONS) {
      expect(screen.getByText(operation.path)).toBeInTheDocument();
      expect(screen.getByText((_, node) => node?.tagName === "CODE" && node.textContent === operation.curl("https://public-api.example.com"))).toBeInTheDocument();
    }
    expect(screen.getAllByText(/X-Requester/).length).toBeGreaterThan(0);
  });
});
