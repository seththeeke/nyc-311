import { z } from "zod";
import { SCORECARD_METRICS } from "./staffMeeting";

/*
 * A member of BoroughSim's executive team (#146). Not a stored entity:
 * the CEO is the human owner, and everyone else is a Claude Code agent
 * on the Mac mini. The roster is fixed content shipped with the page.
 */
export const TEAM_ROLES = ["CEO", "CHIEF_OF_STAFF", "COO", "CPO", "CFO", "CTO", "ENGINEER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const MEMBER_KINDS = ["HUMAN", "AGENT"] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];

export const TeamMemberSchema = z.object({
  member_id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  /* Who they are in the cast: a dwarf foreman, an oracle, a leprechaun. */
  character: z.string().min(1),
  role: z.enum(TEAM_ROLES),
  kind: z.enum(MEMBER_KINDS),
  /* The agent definition this persona fronts (`.claude/agents/<name>.md`); null for the human. */
  agent_name: z.string().nullable(),
  reports_to: z.string().nullable(),
  /* Three.js model key; null shows the initial instead. */
  model_key: z.string().nullable(),
  tagline: z.string().min(1),
  bio: z.string().min(1),
  mandate: z.array(z.string().min(1)),
  /* Where this member's goal pulls against another's: the creative friction. */
  pushes_back_on: z.string().min(1),
  owns_metrics: z.array(z.enum(SCORECARD_METRICS)),
  /* When the agent runs on the Mac mini. */
  cadence: z.string().min(1),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;
