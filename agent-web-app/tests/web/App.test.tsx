import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../../web/App.tsx";
import { makeHealth, stubApi, testClient } from "./fixtures.tsx";

describe("App", () => {
  it("renders the shell with the browser router, with or without a client passed in", async () => {
    stubApi({ "/health": makeHealth(), "/agents": [] });
    const { unmount } = render(<App client={testClient()} />);
    expect(await screen.findByText("0 agents · 0 running now")).toBeInTheDocument();
    unmount();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Agent Monitor" })).toBeInTheDocument();
  });
});
