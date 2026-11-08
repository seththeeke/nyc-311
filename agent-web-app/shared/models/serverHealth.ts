import { z } from "zod";
import { healthFindingSchema } from "./healthFinding.ts";

/** `GET /api/health`: the server is up, the paths it reads, and machine-wide findings (e.g. the scheduler clone's state). */
export const serverHealthSchema = z.object({
  ok: z.literal(true),
  logRoot: z.string(),
  schedulerClone: z.string(),
  primaryCheckout: z.string(),
  launchAgentsDir: z.string(),
  findings: z.array(healthFindingSchema),
});
export type ServerHealth = z.infer<typeof serverHealthSchema>;
