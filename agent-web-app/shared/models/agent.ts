import { z } from "zod";
import { agentConfigSchema } from "./agentConfig.ts";
import { launchdJobSchema } from "./launchdJob.ts";
import { healthFindingSchema } from "./healthFinding.ts";
import { runSummarySchema } from "./run.ts";

/** Everything the dashboard shows for one agent. */
export const agentSchema = z.object({
  config: agentConfigSchema,
  job: launchdJobSchema,
  health: z.array(healthFindingSchema),
  nextFireAt: z.string().nullable(),
  lastRun: runSummarySchema.nullable(),
  currentRun: runSummarySchema.nullable(),
});
export type Agent = z.infer<typeof agentSchema>;

export const agentListSchema = z.array(agentSchema);
