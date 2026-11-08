import { z } from "zod";

/** One git worktree of either checkout. `agent` and `createdAt` come from the `<agent>-<epoch>-<rand>` name, when it has that shape. */
export const worktreeSchema = z.object({
  checkout: z.string(),
  path: z.string(),
  branch: z.string().nullable(),
  head: z.string().nullable(),
  dirtyCount: z.number(),
  agent: z.string().nullable(),
  createdAt: z.string().nullable(),
  isPrimary: z.boolean(),
});
export type Worktree = z.infer<typeof worktreeSchema>;

export const worktreeListSchema = z.array(worktreeSchema);
