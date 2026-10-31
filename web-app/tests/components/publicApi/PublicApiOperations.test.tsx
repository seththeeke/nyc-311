import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicApiOperations } from "../../../src/components/publicApi/PublicApiOperations";
import { PUBLIC_API_OPERATIONS } from "../../../src/components/publicApi/publicApiOperationList";

describe("PublicApiOperations", () => {
  it("lists every operation with its base URL, requester note and a curl example, and no marketing copy", () => {
    render(<PublicApiOperations baseUrl="https://public-api.example.com" />);
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByText("https://public-api.example.com")).toBeInTheDocument();
    expect(screen.getByText("X-Requester")).toBeInTheDocument();
    for (const operation of PUBLIC_API_OPERATIONS) {
      expect(screen.getByText(operation.path)).toBeInTheDocument();
      expect(screen.getByText((_, node) => node?.tagName === "CODE" && node.textContent === operation.curl("https://public-api.example.com"))).toBeInTheDocument();
    }
    expect(screen.queryByText("Build on BoroughSim")).not.toBeInTheDocument();
  });
});
