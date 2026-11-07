import { z } from "zod";
import { TEAM_CHAT_REACTION_EMOJIS, TEAM_CHAT_TAGS_MAX, TEAM_CHAT_TEXT_MAX } from "../../models/teamChatMessage";
import type { TeamChatClient } from "../../service/teamChatClient/teamChatClient";
import { defineTool, type McpTool } from "./mcpTool";

export type TeamChatTool = McpTool<TeamChatClient>;

const tool = defineTool<TeamChatClient>();

const channelId = z.string().describe("Channel id, e.g. tech-team or executive-team.");
const messageId = z.string().describe("A message_id from read_channel, read_thread or read_inbox.");
const threadId = z.string().optional().describe("For a reply: its thread's root message_id.");
const text = z.string().min(1).max(TEAM_CHAT_TEXT_MAX).describe("Markdown. Mention teammates as @Handle (@Seth, @Rex, @Pip, @Brogan…) or everyone as @channel. Everything posted is public.");
const tag = z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/);
const tags = z.array(tag).max(TEAM_CHAT_TAGS_MAX).default([]).describe("ALL_CAPS labels, e.g. DEVX_RUN.");
/* A top-level post must say what it is: an untagged run post can't be found by the next run (Penny's DAILY_BRIEF), so it fails here, before anything is sent. */
const postTags = z.array(tag).min(1).max(TEAM_CHAT_TAGS_MAX).describe("Required: at least one ALL_CAPS label naming the post, e.g. DEVX_RUN, DAILY_BRIEF, COO_RUN.");
const limit = z.number().int().min(1).max(100).optional();

/*
 * The team-chat MCP tools (docs/17-executive-team.md §10.7). Each is a
 * controller in the CLAUDE.md §5.2 sense: the MCP SDK validates its input
 * against the zod shape, then it calls the TeamChatClient service.
 */
export const TEAM_CHAT_TOOLS: readonly TeamChatTool[] = [
  tool({ name: "list_channels", description: "List Team Chat's channels, with their topics and members.", inputSchema: {}, run: (client) => client.listChannels() }),
  tool({
    name: "read_channel",
    description: "Read a channel's top-level messages, newest first. Pass after=<message_id> for only what's new, or before=<message_id> to page back.",
    inputSchema: { channel_id: channelId, after: z.string().optional(), before: z.string().optional(), limit },
    run: (client, args) => client.readChannel(args.channel_id, { after: args.after, before: args.before, limit: args.limit }),
  }),
  tool({
    name: "read_thread",
    description: "Read a top-level message and its replies, oldest first.",
    inputSchema: { channel_id: channelId, message_id: messageId },
    run: (client, args) => client.readThread(args.channel_id, args.message_id),
  }),
  tool({
    name: "read_inbox",
    description: "Read your inbox: mentions of you and replies in threads you're in, oldest first, after what you last marked read.",
    inputSchema: { after: z.string().optional(), limit },
    run: (client, args) => client.readInbox({ after: args.after, limit: args.limit }),
  }),
  tool({
    name: "mark_inbox_read",
    description: "Mark your inbox read up to and including entry_id.",
    inputSchema: { entry_id: z.string().min(1) },
    run: (client, args) => client.markInboxRead(args.entry_id),
  }),
  tool({
    name: "post_message",
    description: "Post a top-level message to a channel you're a member of. tags is required: post once, with your run's tag.",
    inputSchema: { channel_id: channelId, text, tags: postTags },
    run: (client, args) => client.postMessage(args.channel_id, args.text, args.tags),
  }),
  tool({
    name: "reply",
    description: "Reply in a top-level message's thread.",
    inputSchema: { channel_id: channelId, message_id: messageId, text, tags },
    run: (client, args) => client.reply(args.channel_id, args.message_id, args.text, args.tags),
  }),
  tool({
    name: "edit_message",
    description: "Edit one of your own messages.",
    inputSchema: { channel_id: channelId, message_id: messageId, thread_id: threadId, text },
    run: (client, args) => client.editMessage(args.channel_id, args.message_id, args.thread_id, args.text),
  }),
  tool({
    name: "react",
    description: `React to a message with one of ${TEAM_CHAT_REACTION_EMOJIS.join(" ")}, or remove your reaction.`,
    inputSchema: { channel_id: channelId, message_id: messageId, thread_id: threadId, emoji: z.enum(TEAM_CHAT_REACTION_EMOJIS), remove: z.boolean().default(false) },
    run: (client, args) => client.react(args.channel_id, args.message_id, args.thread_id, args.emoji, args.remove),
  }),
];
