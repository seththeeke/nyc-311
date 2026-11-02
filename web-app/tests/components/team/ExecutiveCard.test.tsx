import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveCard } from "../../../src/components/team/ExecutiveCard";
import { memberById } from "../../../src/components/team/teamRoster";

let webGl = false;
vi.mock("../../../src/components/three/webgl", () => ({ isWebGlAvailable: () => webGl }));
vi.mock("../../../src/components/team/TeamStage", () => ({
  default: ({ name }: { name: string }) => <canvas role="img" aria-label={`${name}, performing`} />,
}));

/* With no IntersectionObserver every card counts as on screen. */
beforeEach(() => vi.stubGlobal("IntersectionObserver", undefined));
afterEach(() => {
  webGl = false;
  vi.unstubAllGlobals();
});

describe("ExecutiveCard", () => {
  it("leads with the title, then the responsibility, the goal and its metric, and opens contributions", async () => {
    const open = vi.fn();
    render(<ExecutiveCard member={memberById("coo")!} flip={false} onViewContributions={open} />);
    const card = screen.getByRole("article", { name: "Chief Operating Officer" });
    expect(card).toHaveAttribute("id", "member-coo");
    expect(card.className).toContain("opacity-100");
    expect(screen.getByRole("heading", { level: 2, name: "Chief Operating Officer" })).toBeInTheDocument();
    expect(screen.getByText("Brogan Anvilhand ·", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Goal" })).toBeInTheDocument();
    expect(screen.getByText("Median time to resolve", { exact: false })).toHaveTextContent("1–2 days");
    expect(screen.getByText("coo-agent")).toBeInTheDocument();
    expect(screen.getByText("Chief Executive Officer")).toBeInTheDocument();
    expect(screen.queryByText("AI agent")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "View Contributions" }));
    expect(open).toHaveBeenCalledWith("coo");
  });

  it("leaves out the goals section for a member with no goals yet", () => {
    render(<ExecutiveCard member={{ ...memberById("chief-of-staff")!, goals: [] }} flip={false} onViewContributions={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: /^Goals?$/ })).not.toBeInTheDocument();
  });

  it("puts the figure on stage when WebGL is there, on the far side for flipped cards, and says Goals for several", async () => {
    webGl = true;
    render(<ExecutiveCard member={memberById("cfo")!} flip onViewContributions={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "Fergus Farthing, performing" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fergus Farthing, performing" }).closest("div")?.className).toContain("lg:order-2");
    expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
  });

  it("shows an initial for an agent when there's no WebGL", () => {
    render(<ExecutiveCard member={memberById("cto")!} flip={false} onViewContributions={vi.fn()} />);
    expect(screen.getByText("R")).toBeInTheDocument();
  });

});
