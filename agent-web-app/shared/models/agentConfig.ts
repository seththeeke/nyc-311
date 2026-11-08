import { z } from "zod";
import { scheduleSlotSchema } from "./scheduleSlot.ts";

/** How the runner picks a mode for an agent: `KIND` in its schedule `.env`, as ALL_CAPS. */
export const agentKindSchema = z.enum(["PR_LIMIT", "ASSIGNED_ISSUE", "OPERATIONS"]);
export type AgentKind = z.infer<typeof agentKindSchema>;

/** One agent's schedule config, read from `scripts/agent-schedules/<agent>.env` in the scheduler clone. */
export const agentConfigSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  kind: agentKindSchema,
  schedule: z.array(scheduleSlotSchema),
  model: z.string().nullable(),
  teamChatEnv: z.string().nullable(),
  branchPrefix: z.string().nullable(),
  maxOpenPrs: z.number().nullable(),
  flags: z.array(z.string()),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;
