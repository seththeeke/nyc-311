import { describe, expect, it } from "vitest";
import { parseDescription, parseEnv, parseSchedule, toAgentConfig } from "../../../server/service/agentConfigService.ts";

describe("agentConfigService", () => {
  it("parses KEY=value lines, unquoting and skipping comments and non-assignments", () => {
    expect(parseEnv('# c\nA="x y"\nB=\'z\'\nC=3\nlower=no\nD="unterminated\n  E=1')).toEqual({ A: "x y", B: "z", C: "3", D: '"unterminated', E: "1" });
  });

  it("parses schedule slots with days and modes, dropping malformed ones", () => {
    expect(parseSchedule("05:00=AUDIT Mon@21:30 7:05 bogus 25:00x Xyz@01:00")).toEqual([
      { day: null, time: "05:00", mode: "AUDIT" },
      { day: "Mon", time: "21:30", mode: null },
      { day: null, time: "07:05", mode: null },
    ]);
    expect(parseSchedule(undefined)).toEqual([]);
  });

  it("reads a folded, a quoted or a missing description", () => {
    expect(parseDescription("---\ndescription: >\n  One\n  two.\nname: x\n---")).toBe("One two.");
    expect(parseDescription('---\ndescription: "Quoted."\n---')).toBe("Quoted.");
    expect(parseDescription("---\nname: x\n---")).toBeNull();
    expect(parseDescription("---\ndescription: >\nname: x\n---")).toBeNull();
    expect(parseDescription("no frontmatter")).toBeNull();
    expect(parseDescription(null)).toBeNull();
  });

  it("builds a config, defaulting KIND to pr-limit and an unknown KIND too", () => {
    expect(toAgentConfig("a", 'KIND=operations\nSCHEDULE="09:00"\nMODEL=opus\nTEAM_CHAT_ENV=PROD\nMEMORY=1\nREPORTS=0', null)).toEqual({
      name: "a", description: null, kind: "OPERATIONS", schedule: [{ day: null, time: "09:00", mode: null }],
      model: "opus", teamChatEnv: "PROD", branchPrefix: null, maxOpenPrs: null, flags: ["MEMORY"],
    });
    expect(toAgentConfig("b", 'BRANCH_PREFIX="devx/"\nMAX_OPEN_PRS=3', null)).toMatchObject({ kind: "PR_LIMIT", branchPrefix: "devx/", maxOpenPrs: 3 });
    expect(toAgentConfig("c", "KIND=weird\nMAX_OPEN_PRS=x", null)).toMatchObject({ kind: "PR_LIMIT", maxOpenPrs: null });
    expect(toAgentConfig("d", 'KIND="board"', null).kind).toBe("BOARD");
    expect(toAgentConfig("e", "KIND=board\nENGINEERING_TOOLS=1\nMEMORY=1", null).flags).toEqual(["ENGINEERING_TOOLS", "MEMORY"]);
  });
});
