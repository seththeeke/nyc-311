import { createHash } from "node:crypto";
import { ulid } from "ulid";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo } from "../../logger";
import { TeamChatDao } from "../../dao/teamChat/teamChatDao";
import { ForbiddenError, NotFoundError, ValidationError } from "../../models/errors";
import type { TeamChatChannel } from "../../models/teamChatChannel";
import type { TeamChatInboxEntry } from "../../models/teamChatInboxEntry";
import type { TeamChatMember } from "../../models/teamChatMember";
import { TEAM_CHAT_MENTION_CHANNEL, type TeamChatEditBody, type TeamChatMessage, type TeamChatPostBody, type TeamChatReactionEmoji } from "../../models/teamChatMessage";
import type { TeamChatPage } from "../../models/teamChatPage";
import { parseMentions } from "./teamChatMentions";
import { findSecret } from "./teamChatSecrets";

/* Posts and replies per member per day (docs/17-executive-team.md §10.5). */
export const TEAM_CHAT_DAILY_WRITE_CAP = 200;

export interface TeamChatServiceDeps {
  dao?: TeamChatDao;
  now?: () => Date;
  newId?: () => string;
}

export interface TeamChatPageQuery {
  before?: string;
  after?: string;
  limit: number;
}

export interface TeamChatThread {
  root: TeamChatMessage;
  replies: TeamChatPage<TeamChatMessage>;
}

/* Lazily constructed per CLAUDE.md §5.2 — never a module-scope singleton. */
function getDao(deps: TeamChatServiceDeps): TeamChatDao {
  return deps.dao ?? new TeamChatDao(createDocumentClient(), requireEnv("TEAM_CHAT_TABLE_NAME"));
}

function nowOf(deps: TeamChatServiceDeps): Date {
  return deps.now ? deps.now() : new Date();
}

function toPage<T>(items: T[], limit: number, cursorOf: (item: T) => string): TeamChatPage<T> {
  const page = items.slice(0, limit);
  return { items: page, next_cursor: items.length > limit && page.length > 0 ? cursorOf(page[page.length - 1]) : null };
}

async function readableChannel(dao: TeamChatDao, channelId: string): Promise<TeamChatChannel> {
  const channel = await dao.getChannel(channelId);
  if (!channel || channel.visibility !== "PUBLIC") throw new NotFoundError(`Channel ${channelId} not found`);
  return channel;
}

async function writableChannel(dao: TeamChatDao, caller: TeamChatMember, channelId: string): Promise<TeamChatChannel> {
  const channel = await dao.getChannel(channelId);
  if (!channel) throw new NotFoundError(`Channel ${channelId} not found`);
  if (!channel.member_ids.includes(caller.member_id)) {
    logInfo("TeamChatService.notAMember", { memberId: caller.member_id, channelId });
    throw new ForbiddenError(`Not a member of ${channelId}`);
  }
  return channel;
}

async function existingMessage(dao: TeamChatDao, channelId: string, messageId: string, threadId: string | null): Promise<TeamChatMessage> {
  const message = await dao.getMessage(channelId, messageId, threadId);
  if (!message) throw new NotFoundError(`Message ${messageId} not found`);
  return message;
}

function refuseSecrets(text: string): void {
  const secret = findSecret(text);
  if (secret) throw new ValidationError(`Text looks like it contains a ${secret}; everything in Team Chat is public`);
}

/** Every public channel, by name. */
export async function listPublicChannels(deps: TeamChatServiceDeps = {}): Promise<TeamChatChannel[]> {
  const channels = (await getDao(deps).listChannels()).filter((channel) => channel.visibility === "PUBLIC");
  logInfo("TeamChatService.listPublicChannels", { count: channels.length });
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

/** A public channel's top-level messages, newest first. */
export async function getTimeline(channelId: string, query: TeamChatPageQuery, deps: TeamChatServiceDeps = {}): Promise<TeamChatPage<TeamChatMessage>> {
  const dao = getDao(deps);
  await readableChannel(dao, channelId);
  const messages = await dao.listTimeline(channelId, query);
  logInfo("TeamChatService.getTimeline", { channelId, query, count: messages.length });
  return toPage(messages, query.limit, (message) => message.message_id);
}

/** A top-level message and its replies, oldest first. */
export async function getThread(channelId: string, messageId: string, query: TeamChatPageQuery, deps: TeamChatServiceDeps = {}): Promise<TeamChatThread> {
  const dao = getDao(deps);
  await readableChannel(dao, channelId);
  const root = await existingMessage(dao, channelId, messageId, null);
  const replies = await dao.listReplies(channelId, messageId, query);
  logInfo("TeamChatService.getThread", { channelId, messageId, count: replies.length });
  return { root, replies: toPage(replies, query.limit, (reply) => reply.message_id) };
}

/** The active member an ID token's email resolves to. */
export async function resolveCaller(email: string, deps: TeamChatServiceDeps = {}): Promise<TeamChatMember> {
  const member = (await getDao(deps).listMembers()).find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (!member || member.status !== "ACTIVE") {
    logInfo("TeamChatService.resolveCallerDenied", { email, found: Boolean(member) });
    throw new ForbiddenError("Not an active Team Chat member");
  }
  logInfo("TeamChatService.resolveCaller", { email, memberId: member.member_id });
  return member;
}

interface CreateArgs {
  caller: TeamChatMember;
  channel: TeamChatChannel;
  body: TeamChatPostBody;
  root: TeamChatMessage | null;
  deps: TeamChatServiceDeps;
  dao: TeamChatDao;
}

async function create({ caller, channel, body, root, deps, dao }: CreateArgs): Promise<{ message: TeamChatMessage; replayed: boolean }> {
  refuseSecrets(body.text);
  const now = nowOf(deps);
  const newId = deps.newId ?? ulid;
  const members = (await dao.listMembers()).filter((member) => channel.member_ids.includes(member.member_id));
  const mentions = parseMentions(body.text, members);
  const message: TeamChatMessage = {
    message_id: newId(),
    channel_id: channel.channel_id,
    thread_id: root?.message_id ?? null,
    author_id: caller.member_id,
    author_kind: caller.kind,
    text: body.text,
    tags: body.tags,
    mentions,
    reactions: {},
    reply_count: 0,
    last_reply_at: null,
    reply_author_ids: [],
    created_at: now.toISOString(),
    edited_at: null,
    deleted_at: null,
  };

  const mentioned = new Set(mentions.includes(TEAM_CHAT_MENTION_CHANNEL) ? channel.member_ids : mentions);
  const participants = root ? new Set([root.author_id, ...root.reply_author_ids]) : new Set<string>();
  const entry = (memberId: string, kind: TeamChatInboxEntry["kind"]): TeamChatInboxEntry => ({
    member_id: memberId,
    entry_id: newId(),
    kind,
    channel_id: channel.channel_id,
    message_id: message.message_id,
    thread_id: message.thread_id,
    author_id: caller.member_id,
    created_at: message.created_at,
  });
  const inbox = [
    ...[...mentioned].filter((id) => id !== caller.member_id && channel.member_ids.includes(id)).map((id) => entry(id, "MENTION")),
    ...[...participants].filter((id) => id !== caller.member_id && !mentioned.has(id)).map((id) => entry(id, "THREAD_REPLY")),
  ];

  const bodyHash = createHash("sha256").update(JSON.stringify({ text: body.text, tags: body.tags, thread: message.thread_id, channel: channel.channel_id })).digest("hex");
  const result = await dao.createMessage({
    message,
    clientToken: body.client_token,
    bodyHash,
    writeCap: TEAM_CHAT_DAILY_WRITE_CAP,
    day: message.created_at.slice(0, 10),
    inbox,
    nowEpochSeconds: Math.floor(now.getTime() / 1000),
  });
  logInfo("TeamChatService.create", { memberId: caller.member_id, messageId: result.message.message_id, replayed: result.replayed, mentions, inbox: inbox.length });
  return result;
}

/** Posts a top-level message as the caller. */
export async function postMessage(caller: TeamChatMember, channelId: string, body: TeamChatPostBody, deps: TeamChatServiceDeps = {}): Promise<{ message: TeamChatMessage; replayed: boolean }> {
  const dao = getDao(deps);
  const channel = await writableChannel(dao, caller, channelId);
  return create({ caller, channel, body, root: null, deps, dao });
}

/** Replies in a top-level message's thread as the caller. */
export async function postReply(caller: TeamChatMember, channelId: string, rootId: string, body: TeamChatPostBody, deps: TeamChatServiceDeps = {}): Promise<{ message: TeamChatMessage; replayed: boolean }> {
  const dao = getDao(deps);
  const channel = await writableChannel(dao, caller, channelId);
  const root = await existingMessage(dao, channelId, rootId, null);
  if (root.deleted_at) throw new NotFoundError(`Message ${rootId} was deleted`);
  return create({ caller, channel, body, root, deps, dao });
}

async function ownMessage(dao: TeamChatDao, caller: TeamChatMember, channelId: string, messageId: string, threadId: string | null): Promise<{ message: TeamChatMessage; channel: TeamChatChannel }> {
  const channel = await writableChannel(dao, caller, channelId);
  const message = await existingMessage(dao, channelId, messageId, threadId);
  if (message.author_id !== caller.member_id) throw new ForbiddenError("Only the author can change a message");
  if (message.deleted_at) throw new NotFoundError(`Message ${messageId} was deleted`);
  return { message, channel };
}

/** Edits the caller's own message; mentions are re-parsed but no new inbox entries are written. */
export async function editMessage(caller: TeamChatMember, channelId: string, messageId: string, threadId: string | null, body: TeamChatEditBody, deps: TeamChatServiceDeps = {}): Promise<TeamChatMessage> {
  const dao = getDao(deps);
  const { message, channel } = await ownMessage(dao, caller, channelId, messageId, threadId);
  refuseSecrets(body.text);
  const members = (await dao.listMembers()).filter((member) => channel.member_ids.includes(member.member_id));
  const mentions = parseMentions(body.text, members);
  const editedAt = nowOf(deps).toISOString();
  await dao.updateText(message, body.text, mentions, editedAt);
  logInfo("TeamChatService.editMessage", { memberId: caller.member_id, messageId });
  return { ...message, text: body.text, mentions, edited_at: editedAt };
}

/** Tombstones the caller's own message: its row stays so its thread holds together. */
export async function deleteMessage(caller: TeamChatMember, channelId: string, messageId: string, threadId: string | null, deps: TeamChatServiceDeps = {}): Promise<void> {
  const dao = getDao(deps);
  const { message } = await ownMessage(dao, caller, channelId, messageId, threadId);
  await dao.tombstone(message, nowOf(deps).toISOString());
  logInfo("TeamChatService.deleteMessage", { memberId: caller.member_id, messageId });
}

/** Adds or removes the caller's reaction. */
export async function setReaction(caller: TeamChatMember, channelId: string, messageId: string, threadId: string | null, emoji: TeamChatReactionEmoji, add: boolean, deps: TeamChatServiceDeps = {}): Promise<void> {
  const dao = getDao(deps);
  await writableChannel(dao, caller, channelId);
  const message = await existingMessage(dao, channelId, messageId, threadId);
  await dao.setReaction(message, emoji, caller.member_id, add);
  logInfo("TeamChatService.setReaction", { memberId: caller.member_id, messageId, emoji, add });
}

/** The caller's inbox, oldest first, after `after` or their read cursor. */
export async function getInbox(caller: TeamChatMember, query: TeamChatPageQuery, deps: TeamChatServiceDeps = {}): Promise<TeamChatPage<TeamChatInboxEntry>> {
  const after = query.after ?? caller.inbox_read_id ?? undefined;
  const entries = await getDao(deps).listInbox(caller.member_id, { after, limit: query.limit });
  logInfo("TeamChatService.getInbox", { memberId: caller.member_id, after, count: entries.length });
  return toPage(entries, query.limit, (entry) => entry.entry_id);
}

/** Advances the caller's inbox read cursor. */
export async function markInboxRead(caller: TeamChatMember, entryId: string, deps: TeamChatServiceDeps = {}): Promise<void> {
  await getDao(deps).setInboxRead(caller.member_id, entryId);
  logInfo("TeamChatService.markInboxRead", { memberId: caller.member_id, entryId });
}
