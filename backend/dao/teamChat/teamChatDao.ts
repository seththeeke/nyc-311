import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { ZodType } from "zod";
import { z } from "zod";
import { logInfo } from "../../logger";
import { ConflictError, NotFoundError, RateLimitedError, ValidationError } from "../../models/errors";
import { TeamChatChannelSchema, type TeamChatChannel, type TeamChatChannelSeed } from "../../models/teamChatChannel";
import { TeamChatInboxEntrySchema, type TeamChatInboxEntry } from "../../models/teamChatInboxEntry";
import { TeamChatMemberSchema, type TeamChatMember, type TeamChatMemberSeed } from "../../models/teamChatMember";
import { TeamChatMessageSchema, type TeamChatMessage } from "../../models/teamChatMessage";

/*
 * The one TeamChat table (docs/17-executive-team.md §10.3). Keys:
 * WORKSPACE / CHANNEL#id and MEMBER#id; CHANNEL#id / MESSAGE#ulid for posts
 * and THREAD#root#ulid for replies; INBOX#member / ulid; CLIENT#member#token
 * markers and WRITES#member / day counters, both with a TTL.
 */
const WORKSPACE = "WORKSPACE";
const MARKER_TTL_SECONDS = 24 * 60 * 60;
const INBOX_TTL_SECONDS = 30 * 24 * 60 * 60;
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

const channelSk = (channelId: string): string => `CHANNEL#${channelId}`;
const memberSk = (memberId: string): string => `MEMBER#${memberId}`;
const channelPk = (channelId: string): string => `CHANNEL#${channelId}`;
const messageSk = (messageId: string): string => `MESSAGE#${messageId}`;
const replyPrefix = (rootId: string): string => `THREAD#${rootId}#`;
const inboxPk = (memberId: string): string => `INBOX#${memberId}`;

/** The sort key of a top-level message or a reply. */
export function messageKey(channelId: string, messageId: string, threadId: string | null): { pk: string; sk: string } {
  return { pk: channelPk(channelId), sk: threadId ? `${replyPrefix(threadId)}${messageId}` : messageSk(messageId) };
}

const MarkerSchema = z.object({
  message_id: z.string(),
  channel_id: z.string(),
  thread_id: z.string().nullable(),
  body_hash: z.string(),
});

export interface PageQuery {
  before?: string;
  after?: string;
  limit: number;
}

export interface CreateMessageInput {
  message: TeamChatMessage;
  clientToken: string;
  bodyHash: string;
  /* Writes per member per day (§10.5). */
  writeCap: number;
  day: string;
  inbox: TeamChatInboxEntry[];
  nowEpochSeconds: number;
}

export interface CreateMessageResult {
  message: TeamChatMessage;
  replayed: boolean;
}

function parseAll<T>(schema: ZodType<T, z.ZodTypeDef, unknown>, items: Record<string, unknown>[] | undefined, what: string): T[] {
  return (items ?? []).map((item) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) throw new ValidationError(`Stored ${what} failed validation`, parsed.error.issues);
    return parsed.data;
  });
}

export class TeamChatDao {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  private async query(input: Omit<ConstructorParameters<typeof QueryCommand>[0], "TableName">): Promise<Record<string, unknown>[]> {
    logInfo("TeamChatDao.query", { table: this.tableName, input });
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, ...input }));
    return result.Items ?? [];
  }

  async listChannels(): Promise<TeamChatChannel[]> {
    const items = await this.query({ KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)", ExpressionAttributeValues: { ":pk": WORKSPACE, ":prefix": "CHANNEL#" } });
    return parseAll(TeamChatChannelSchema, items, "channel");
  }

  async listMembers(): Promise<TeamChatMember[]> {
    const items = await this.query({ KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)", ExpressionAttributeValues: { ":pk": WORKSPACE, ":prefix": "MEMBER#" } });
    return parseAll(TeamChatMemberSchema, items, "member");
  }

  async getChannel(channelId: string): Promise<TeamChatChannel | null> {
    logInfo("TeamChatDao.getChannel", { table: this.tableName, channelId });
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { pk: WORKSPACE, sk: channelSk(channelId) } }));
    return result.Item ? parseAll(TeamChatChannelSchema, [result.Item], "channel")[0] : null;
  }

  async getMessage(channelId: string, messageId: string, threadId: string | null): Promise<TeamChatMessage | null> {
    const key = messageKey(channelId, messageId, threadId);
    logInfo("TeamChatDao.getMessage", { table: this.tableName, key });
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key }));
    return result.Item ? parseAll(TeamChatMessageSchema, [result.Item], "message")[0] : null;
  }

  /** Top-level messages, newest first. `after` returns only newer ones; `before` pages back. */
  async listTimeline(channelId: string, page: PageQuery): Promise<TeamChatMessage[]> {
    const pk = channelPk(channelId);
    const range = page.after
      ? { cond: "sk BETWEEN :lo AND :hi", values: { ":lo": messageSk(page.after), ":hi": "MESSAGE#~" } }
      : page.before
        ? { cond: "sk BETWEEN :lo AND :hi", values: { ":lo": "MESSAGE#", ":hi": messageSk(page.before) } }
        : { cond: "begins_with(sk, :lo)", values: { ":lo": "MESSAGE#" } };
    const items = await this.query({
      KeyConditionExpression: `pk = :pk AND ${range.cond}`,
      ExpressionAttributeValues: { ":pk": pk, ...range.values },
      ScanIndexForward: false,
      Limit: page.limit + 1,
    });
    const cursor = page.after ?? page.before;
    return parseAll(TeamChatMessageSchema, items, "message").filter((message) => message.message_id !== cursor);
  }

  /** A thread's replies, oldest first; `after` returns only newer ones. */
  async listReplies(channelId: string, rootId: string, page: PageQuery): Promise<TeamChatMessage[]> {
    const prefix = replyPrefix(rootId);
    const range = page.after
      ? { cond: "sk BETWEEN :lo AND :hi", values: { ":lo": `${prefix}${page.after}`, ":hi": `${prefix}~` } }
      : { cond: "begins_with(sk, :lo)", values: { ":lo": prefix } };
    const items = await this.query({
      KeyConditionExpression: `pk = :pk AND ${range.cond}`,
      ExpressionAttributeValues: { ":pk": channelPk(channelId), ...range.values },
      Limit: page.limit + 1,
    });
    return parseAll(TeamChatMessageSchema, items, "message").filter((message) => message.message_id !== page.after);
  }

  /**
   * Writes a post or a reply in one transaction (§10.3): the message, the
   * retry marker, the daily write counter, the channel's or root's
   * summary, and the inbox entries. A taken marker returns the original.
   *
   * @throws {@link RateLimitedError} over the write cap; {@link NotFoundError} when the channel or root is gone; {@link ConflictError} for a reused token with a different body.
   */
  async createMessage(input: CreateMessageInput): Promise<CreateMessageResult> {
    const { message } = input;
    const markerKey = { pk: `CLIENT#${message.author_id}#${input.clientToken}`, sk: "CLIENT" };
    logInfo("TeamChatDao.createMessage", { table: this.tableName, messageId: message.message_id, threadId: message.thread_id, inbox: input.inbox.length });

    const summary = message.thread_id
      ? {
          Update: {
            TableName: this.tableName,
            Key: messageKey(message.channel_id, message.thread_id, null),
            UpdateExpression: "SET reply_count = reply_count + :one, last_reply_at = :at ADD reply_author_ids :author",
            ConditionExpression: "attribute_exists(pk) AND attribute_type(deleted_at, :nullType)",
            ExpressionAttributeValues: { ":one": 1, ":at": message.created_at, ":author": new Set([message.author_id]), ":nullType": "NULL" },
          },
        }
      : {
          Update: {
            TableName: this.tableName,
            Key: { pk: WORKSPACE, sk: channelSk(message.channel_id) },
            UpdateExpression: "SET last_message_id = :id, last_message_at = :at",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeValues: { ":id": message.message_id, ":at": message.created_at },
          },
        };

    /* reply_author_ids is a string set, created by the first reply's ADD; an empty set can't be stored. */
    const stored: Record<string, unknown> = { ...message };
    delete stored.reply_author_ids;
    const transactItems = [
      { Put: { TableName: this.tableName, Item: { ...messageKey(message.channel_id, message.message_id, message.thread_id), ...stored }, ConditionExpression: "attribute_not_exists(pk)" } },
      {
        Put: {
          TableName: this.tableName,
          Item: { ...markerKey, message_id: message.message_id, channel_id: message.channel_id, thread_id: message.thread_id, body_hash: input.bodyHash, expires_at: input.nowEpochSeconds + MARKER_TTL_SECONDS },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
      {
        Update: {
          TableName: this.tableName,
          Key: { pk: `WRITES#${message.author_id}`, sk: input.day },
          UpdateExpression: "ADD writes :one SET expires_at = :ttl",
          ConditionExpression: "attribute_not_exists(writes) OR writes < :cap",
          ExpressionAttributeValues: { ":one": 1, ":cap": input.writeCap, ":ttl": input.nowEpochSeconds + COUNTER_TTL_SECONDS },
        },
      },
      summary,
      ...input.inbox.map((entry) => ({
        Put: { TableName: this.tableName, Item: { pk: inboxPk(entry.member_id), sk: entry.entry_id, ...entry, expires_at: input.nowEpochSeconds + INBOX_TTL_SECONDS } },
      })),
    ];

    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return { message, replayed: false };
    } catch (err) {
      if (!(err instanceof TransactionCanceledException)) throw err;
      const failed = (index: number): boolean => err.CancellationReasons?.[index]?.Code === "ConditionalCheckFailed";
      if (failed(1)) return this.replay(markerKey, input.bodyHash);
      if (failed(2)) throw new RateLimitedError(`Over ${input.writeCap} writes today`);
      if (failed(3)) throw new NotFoundError(message.thread_id ? "Thread root not found" : "Channel not found");
      throw err;
    }
  }

  private async replay(markerKey: { pk: string; sk: string }, bodyHash: string): Promise<CreateMessageResult> {
    logInfo("TeamChatDao.replay", { table: this.tableName, markerKey });
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: markerKey }));
    const marker = MarkerSchema.parse(result.Item);
    if (marker.body_hash !== bodyHash) throw new ConflictError("client_token was already used with a different body");
    const original = await this.getMessage(marker.channel_id, marker.message_id, marker.thread_id);
    if (!original) throw new NotFoundError("Replayed message not found");
    return { message: original, replayed: true };
  }

  async updateText(message: TeamChatMessage, text: string, mentions: string[], editedAt: string): Promise<void> {
    const key = messageKey(message.channel_id, message.message_id, message.thread_id);
    logInfo("TeamChatDao.updateText", { table: this.tableName, key });
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: "SET #text = :text, mentions = :mentions, edited_at = :at",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: { "#text": "text" },
        ExpressionAttributeValues: { ":text": text, ":mentions": mentions, ":at": editedAt },
      })
    );
  }

  async tombstone(message: TeamChatMessage, deletedAt: string): Promise<void> {
    const key = messageKey(message.channel_id, message.message_id, message.thread_id);
    logInfo("TeamChatDao.tombstone", { table: this.tableName, key });
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: "SET #text = :empty, mentions = :none, tags = :none, deleted_at = :at",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: { "#text": "text" },
        ExpressionAttributeValues: { ":empty": "", ":none": [], ":at": deletedAt },
      })
    );
  }

  /** Adds or removes one member under one emoji; idempotent either way. */
  async setReaction(message: TeamChatMessage, emoji: string, memberId: string, add: boolean): Promise<void> {
    const key = messageKey(message.channel_id, message.message_id, message.thread_id);
    logInfo("TeamChatDao.setReaction", { table: this.tableName, key, emoji, memberId, add });
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: `${add ? "ADD" : "DELETE"} reactions.#emoji :member`,
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: { "#emoji": emoji },
        ExpressionAttributeValues: { ":member": new Set([memberId]) },
      })
    );
  }

  /** A member's inbox, oldest first, after their cursor. */
  async listInbox(memberId: string, page: PageQuery): Promise<TeamChatInboxEntry[]> {
    const items = await this.query({
      KeyConditionExpression: page.after ? "pk = :pk AND sk > :after" : "pk = :pk",
      ExpressionAttributeValues: { ":pk": inboxPk(memberId), ...(page.after ? { ":after": page.after } : {}) },
      Limit: page.limit + 1,
    });
    return parseAll(TeamChatInboxEntrySchema, items, "inbox entry");
  }

  async setInboxRead(memberId: string, entryId: string): Promise<void> {
    logInfo("TeamChatDao.setInboxRead", { table: this.tableName, memberId, entryId });
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: WORKSPACE, sk: memberSk(memberId) },
        UpdateExpression: "SET inbox_read_id = :id",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: { ":id": entryId },
      })
    );
  }

  /** Writes a seeded channel's fields, keeping its last_message_* state. */
  async upsertChannel(seed: TeamChatChannelSeed): Promise<void> {
    logInfo("TeamChatDao.upsertChannel", { table: this.tableName, seed });
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: WORKSPACE, sk: channelSk(seed.channel_id) },
        UpdateExpression:
          "SET channel_id = :id, #name = :name, topic = :topic, member_ids = :members, visibility = :visibility, last_message_id = if_not_exists(last_message_id, :null), last_message_at = if_not_exists(last_message_at, :null)",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":id": seed.channel_id, ":name": seed.name, ":topic": seed.topic, ":members": seed.member_ids, ":visibility": seed.visibility, ":null": null },
      })
    );
  }

  /** Writes a seeded member's fields, keeping their inbox_read_id. */
  async upsertMember(seed: TeamChatMemberSeed): Promise<void> {
    logInfo("TeamChatDao.upsertMember", { table: this.tableName, seed });
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: WORKSPACE, sk: memberSk(seed.member_id) },
        UpdateExpression: "SET member_id = :id, handle = :handle, kind = :kind, email = :email, #status = :status, inbox_read_id = if_not_exists(inbox_read_id, :null)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":id": seed.member_id, ":handle": seed.handle, ":kind": seed.kind, ":email": seed.email, ":status": seed.status, ":null": null },
      })
    );
  }
}
