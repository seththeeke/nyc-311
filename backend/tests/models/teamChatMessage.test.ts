import { describe, expect, it } from "vitest";
import { TeamChatMessageSchema, TeamChatPostBodySchema } from "../../models/teamChatMessage";
import { message } from "../teamChatFixtures";

describe("TeamChatMessageSchema", () => {
  it("reads stored string sets as sorted arrays and defaults reply_author_ids", () => {
    const stored: Record<string, unknown> = { ...message() };
    delete stored.reply_author_ids;
    const parsed = TeamChatMessageSchema.parse({ ...stored, reactions: { "👍": new Set(["b", "a"]), "✅": ["c"] } });
    expect(parsed.reactions).toEqual({ "👍": ["a", "b"], "✅": ["c"] });
    expect(parsed.reply_author_ids).toEqual([]);
  });

  it("rejects missing reactions and lowercase tags", () => {
    expect(TeamChatMessageSchema.safeParse({ ...message(), reactions: undefined }).success).toBe(false);
    expect(TeamChatMessageSchema.safeParse({ ...message(), tags: ["devx_run"] }).success).toBe(false);
  });
});

describe("TeamChatPostBodySchema", () => {
  it("trims text, defaults tags and requires a client_token", () => {
    expect(TeamChatPostBodySchema.parse({ text: "  hi  ", client_token: "token-123456" })).toEqual({ text: "hi", tags: [], client_token: "token-123456" });
    expect(TeamChatPostBodySchema.safeParse({ text: "hi" }).success).toBe(false);
  });
});
