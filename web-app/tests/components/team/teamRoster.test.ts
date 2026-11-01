import { describe, expect, it } from "vitest";
import { TeamMemberSchema } from "../../../src/models/teamMember";
import { CEO_ID, TEAM_ROSTER, directReports, memberById } from "../../../src/components/team/teamRoster";

describe("TEAM_ROSTER", () => {
  it("parses, with unique ids and every manager on the roster", () => {
    for (const member of TEAM_ROSTER) expect(TeamMemberSchema.parse(member)).toEqual(member);
    const ids = TEAM_ROSTER.map((member) => member.member_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const member of TEAM_ROSTER) if (member.reports_to) expect(ids).toContain(member.reports_to);
  });

  it("has one human CEO at the top, and devx-agent reporting to the CTO", () => {
    expect(TEAM_ROSTER.filter((member) => member.reports_to === null)).toEqual([memberById(CEO_ID)]);
    expect(TEAM_ROSTER.filter((member) => member.kind === "HUMAN").map((member) => member.role)).toEqual(["CEO"]);
    expect(memberById("devx")).toMatchObject({ agent_name: "devx-agent", reports_to: "cto" });
  });
});

describe("memberById / directReports", () => {
  it("finds a member or returns null", () => {
    expect(memberById("cfo")?.name).toBe("Fergus Farthing");
    expect(memberById("nobody")).toBeNull();
    expect(memberById(null)).toBeNull();
  });

  it("lists direct reports in roster order", () => {
    expect(directReports("cto").map((member) => member.member_id)).toEqual(["devx", "gen-dev"]);
    expect(directReports(CEO_ID).map((member) => member.role)).toEqual(["CHIEF_OF_STAFF", "COO", "CPO", "CFO", "CTO"]);
    expect(directReports("devx")).toEqual([]);
  });
});
