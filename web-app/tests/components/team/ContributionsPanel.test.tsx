import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContributionsPanel } from "../../../src/components/team/ContributionsPanel";
import { CONTRIBUTION_KINDS, CONTRIBUTION_LABEL, contributionsFor, TEAM_CONTRIBUTIONS } from "../../../src/components/team/teamContributions";
import { TEAM_ROSTER } from "../../../src/components/team/teamRoster";
import { inRouter } from "./teamFixtures";

describe("team contributions", () => {
  it("covers everyone on the roster, newest first, with a label for every kind", () => {
    for (const member of TEAM_ROSTER) expect(contributionsFor(member.member_id).length).toBeGreaterThan(0);
    const coo = contributionsFor("coo");
    expect(coo[0].at > coo[1].at).toBe(true);
    for (const kind of CONTRIBUTION_KINDS) expect(CONTRIBUTION_LABEL[kind]).toBeTruthy();
    expect(new Set(TEAM_CONTRIBUTIONS.map((item) => item.contribution_id)).size).toBe(TEAM_CONTRIBUTIONS.length);
    expect(contributionsFor("nobody")).toEqual([]);
  });
});

describe("ContributionsPanel", () => {
  it("lists a member's contributions with reasons and links, and closes", async () => {
    render(inRouter(<ContributionsPanel />, "/team?contributions=coo"));
    expect(screen.getByRole("region", { name: "Brogan Anvilhand's contributions" })).toHaveTextContent("Chief Operating Officer");
    expect(screen.getByText("Added 2 operators in Brooklyn")).toBeInTheDocument();
    expect(screen.getByText(/over the 2-day ceiling/)).toBeInTheDocument();
    expect(screen.getAllByText("Capacity")).toHaveLength(2);
    await userEvent.setup().click(screen.getByRole("button", { name: "Close contributions" }));
    expect(screen.getByText(/Pick View Contributions/)).toBeInTheDocument();
  });

  it("links out when a contribution has somewhere to go", () => {
    render(inRouter(<ContributionsPanel />, "/team?contributions=gen-dev"));
    expect(screen.getAllByRole("link", { name: "Open on GitHub" })[0]).toHaveAttribute("href", "https://github.com/seththeeke/nyc-311/issues/150");
  });
});
