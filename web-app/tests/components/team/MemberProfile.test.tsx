import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberProfile } from "../../../src/components/team/MemberProfile";
import { memberById } from "../../../src/components/team/teamRoster";

let webGl = false;
vi.mock("../../../src/components/three/webgl", () => ({ isWebGlAvailable: () => webGl }));
vi.mock("../../../src/components/team/TeamStage", () => ({
  default: ({ name }: { name: string }) => <canvas role="img" aria-label={`${name}, performing`} />,
}));

afterEach(() => {
  webGl = false;
});

describe("MemberProfile", () => {
  it("shows the mandate, the friction, owned metrics, the agent and the manager, and closes", async () => {
    const onClose = vi.fn();
    render(<MemberProfile member={memberById("coo")!} onClose={onClose} />);
    expect(screen.getByRole("heading", { name: "Brogan Anvilhand" })).toBeInTheDocument();
    expect(screen.getByText("Dwarf foreman")).toBeInTheDocument();
    expect(screen.getByText("Hire and release drivers against the forecast and backlog")).toBeInTheDocument();
    expect(screen.getByText("Any saving that shows up later as a missed SLA.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Owns" })).toHaveTextContent("On-time ordersOpen backlogActive drivers");
    expect(screen.getByText("coo-agent")).toBeInTheDocument();
    expect(screen.getByText("Seth Theeke")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close profile" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("puts the figure on stage when WebGL is there", async () => {
    webGl = true;
    render(<MemberProfile member={memberById("cto")!} onClose={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "Rex Rivet, performing" })).toBeInTheDocument();
  });

  it("leaves out the agent, the manager and the metrics for the human CEO", () => {
    webGl = true;
    render(<MemberProfile member={memberById("ceo")!} onClose={vi.fn()} />);
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Reports to")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Owns" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
