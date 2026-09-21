import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Header } from "../../src/components/Header";

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

describe("Header", () => {
  it("links the app title home", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "BoroughSim" })).toHaveAttribute("href", "/");
  });

  it("links System Monitoring to /monitoring", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "System Monitoring" })).toHaveAttribute("href", "/monitoring");
  });

  it("links Admin to /admin", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("opens the About overlay from a button, without navigating, and closes it again", async () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    const user = userEvent.setup();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "About" }));
    const dialog = screen.getByRole("dialog", { name: "About BoroughSim" });
    expect(dialog.parentElement).toBe(document.body);

    await user.click(screen.getByRole("button", { name: "Close About" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toHaveFocus();
  });

  it("does not change the URL when About is opened from the button", async () => {
    render(
      <MemoryRouter initialEntries={["/monitoring"]}>
        <Header />
        <CurrentPath />
      </MemoryRouter>
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "About" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/monitoring");
  });

  it("opens the About drawer when the URL is /about, and closing it returns to /", async () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <Header />
        <CurrentPath />
      </MemoryRouter>
    );

    expect(screen.getByRole("dialog", { name: "About BoroughSim" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Close About" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/");
    expect(screen.getByTestId("path")).not.toHaveTextContent("/about");
  });
});
