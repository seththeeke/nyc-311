import { z } from "zod";

/** A slice of a run's raw log from `offset`, for the live tail; poll again from `nextOffset`. */
export const logChunkSchema = z.object({
  text: z.string(),
  offset: z.number(),
  nextOffset: z.number(),
});
export type LogChunk = z.infer<typeof logChunkSchema>;
