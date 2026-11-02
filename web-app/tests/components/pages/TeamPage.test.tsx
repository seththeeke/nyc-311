import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamPage } from "../../../src/components/pages/TeamPage";
import { inRouter } from "../team/teamFixtures";


describe("TeamPage", () => {
  it("leads with the goal, then a card for everyone: a chip jumps to a card", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(inRouter(<TeamPage />));
    expect(screen.getByRole("heading", { level: 1, name: "Meet the Team" })).toBeInTheDocument();
    expect(screen.getByText(/A simulation created by a human, run by agents/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Chief Executive Officer" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "CEO" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "CPO" }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?member=cpo");
    expect(screen.getByRole("button", { name: "CPO" })).toHaveAttribute("aria-current", "true");
    await user.click(screen.getAllByRole("button", { name: "View Contributions" })[1]);
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("contributions=coo");
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
