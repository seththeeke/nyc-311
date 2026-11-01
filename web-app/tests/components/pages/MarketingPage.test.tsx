import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MarketingPage } from "../../../src/components/pages/MarketingPage";
import { ThemeProvider } from "../../../src/components/shell/ThemeProvider";
import { MemoryRouter } from "react-router-dom";

describe("MarketingPage", () => {
  it("runs hero to closing call, and both Enter fleet buttons leave the page", async () => {
    const onEnter = vi.fn();
    render(
      <ThemeProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <MarketingPage onEnter={onEnter} />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName("New York reports it. BoroughSim fixes it.");
    for (const name of ["From call to curb.", "This week, in the five boroughs.", "One human. A whole executive team of AI.", "The city is moving right now."]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    for (const button of screen.getAllByRole("button", { name: /Enter fleet/ })) await userEvent.click(button);
    expect(onEnter).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Skip to the fleet" })).not.toBeInTheDocument();
    expect(screen.queryByText("Live on NYC Open Data · 311")).not.toBeInTheDocument();
  });
});
