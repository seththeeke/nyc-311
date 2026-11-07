import { z } from "zod";

/*
 * A member of BoroughSim's executive team (#146). Not a stored entity:
 * the CEO is the human owner, and everyone else is an AI agent. The
 * roster is fixed content shipped with the page.
 */
export const TEAM_ROLES = ["CEO", "CHIEF_OF_STAFF", "COO", "CPO", "CTO", "ENGINEER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const MEMBER_KINDS = ["HUMAN", "AGENT"] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];

/** A goal and the metric it's measured by, with the target to hit. */
export const TeamGoalSchema = z.object({
  goal: z.string().min(1),
  metric: z.string().min(1),
  target: z.string().min(1),
});
export type TeamGoal = z.infer<typeof TeamGoalSchema>;

export const TeamMemberSchema = z.object({
  member_id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  /* Who they are in the cast: a dwarf foreman, an oracle, a bridge troll. */
  character: z.string().min(1),
  role: z.enum(TEAM_ROLES),
  kind: z.enum(MEMBER_KINDS),
  /* The agent definition this persona fronts (`.claude/agents/<name>.md`); null for the human. */
  agent_name: z.string().nullable(),
  reports_to: z.string().nullable(),
  /* Three.js model key; null shows the initial instead. */
  model_key: z.string().nullable(),
  /* The quick-nav label: CEO, CTO, Software Engineer. */
  short_title: z.string().min(1),
  /* A real photo (a path under public/); null shows the figure or initial. */
  photo_url: z.string().nullable(),
  /* Their one job, in a sentence. */
  responsibility: z.string().min(1),
  /* Empty for the CEO, who isn't measured like the agents. */
  goals: z.array(TeamGoalSchema),
  /* Where to find them elsewhere: the CEO's GitHub and LinkedIn. */
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })),
  /* True once the agent actually runs (docs/17-executive-team.md); false shows a Work in progress tag. */
  live: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;
