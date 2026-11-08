import { describe, expect, it } from "vitest";
import { agentListSchema } from "../../shared/models/agent.ts";
import { runDetailSchema } from "../../shared/models/runDetail.ts";
import { serverHealthSchema } from "../../shared/models/serverHealth.ts";
import { worktreeListSchema } from "../../shared/models/worktree.ts";
import { logChunkSchema } from "../../shared/models/logChunk.ts";

describe("shared models", () => {
  it("reject drifted shapes", () => {
    expect(agentListSchema.safeParse([{}]).success).toBe(false);
    expect(runDetailSchema.safeParse({ status: "DONE" }).success).toBe(false);
    expect(serverHealthSchema.safeParse({ ok: false }).success).toBe(false);
    expect(worktreeListSchema.safeParse([{ path: 1 }]).success).toBe(false);
    expect(logChunkSchema.parse({ text: "", offset: 0, nextOffset: 0 })).toEqual({ text: "", offset: 0, nextOffset: 0 });
  });
});
