import { z } from "zod";

/** How a manual run's prompt combines with the scheduled one. */
export const promptModeSchema = z.enum(["APPEND", "REPLACE"]);
export type PromptMode = z.infer<typeof promptModeSchema>;

/**
 * `POST /api/agents/:agent/run`: start the agent now, outside its schedule
 * (SPEC.md §5.1). An empty prompt runs the scheduled one; `mode` picks a
 * slot mode (null = the nearest slot's); `testChat` sends its chat posts to
 * Test instead of the agent's own environment.
 */
export const runRequestSchema = z.object({
  prompt: z.string().max(4000).default(""),
  promptMode: promptModeSchema.default("APPEND"),
  mode: z.string().regex(/^[A-Z][A-Z0-9_]*$/).nullable().default(null),
  testChat: z.boolean().default(false),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

/** The started run: the wrapper's pid. Its run log appears under the agent within a second or two. */
export const runStartedSchema = z.object({
  agent: z.string(),
  pid: z.number(),
  requestedAt: z.string(),
});
export type RunStarted = z.infer<typeof runStartedSchema>;
