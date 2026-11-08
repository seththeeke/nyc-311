import { randomUUID } from "node:crypto";
import { logInfo, logWarn } from "../../logger";
import type { TeamChatClientConfig } from "../../models/teamChatClientConfig";
import { IdTokenProvider } from "../agentAuth/idTokenProvider";

/* A write retries a network error or 5xx this many times, with the same client_token. */
const WRITE_RETRIES = 2;

export interface TeamChatClientDeps {
  fetch?: typeof fetch;
  now?: () => Date;
  newToken?: () => string;
}

export interface TeamChatCallResult {
  status: number;
  body: unknown;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** The number of whitespace-separated words in `text`. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** `?a=1&b=2` from the defined values, or "" when there are none. */
function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return params.size ? `?${params.toString()}` : "";
}

/**
 * The agents' Team Chat client (docs/17-executive-team.md §10.7): calls the
 * chat API as the signed-in agent, refreshing its ID token through Cognito,
 * and retries a failed write with the same client_token so a retry never
 * double-posts.
 */
export class TeamChatClient {
  private readonly tokens: IdTokenProvider;
  private readonly fetchFn: typeof fetch;
  private readonly newToken: () => string;

  constructor(
    private readonly config: TeamChatClientConfig,
    deps: TeamChatClientDeps = {}
  ) {
    this.fetchFn = deps.fetch ?? fetch;
    this.newToken = deps.newToken ?? randomUUID;
    this.tokens = new IdTokenProvider(
      { idToken: config.TEAM_CHAT_ID_TOKEN, refreshToken: config.TEAM_CHAT_REFRESH_TOKEN, clientId: config.TEAM_CHAT_CLIENT_ID, region: config.TEAM_CHAT_REGION },
      { fetch: this.fetchFn, now: deps.now }
    );
  }

  private async call(method: Method, path: string, options: { body?: unknown; auth?: boolean; retries?: number } = {}): Promise<TeamChatCallResult> {
    const retries = options.retries ?? 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (options.auth) headers.Authorization = `Bearer ${await this.tokens.token()}`;
        logInfo("TeamChatClient.call", { method, path, attempt });
        const response = await this.fetchFn(`${this.config.TEAM_CHAT_API_URL}${path}`, {
          method,
          headers,
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        });
        if (response.status >= 500 && attempt < retries) {
          logWarn("TeamChatClient.retry", { method, path, status: response.status, attempt });
          continue;
        }
        const text = await response.text();
        return { status: response.status, body: text ? JSON.parse(text) : null };
      } catch (err) {
        if (attempt >= retries) throw err;
        logWarn("TeamChatClient.retry", { method, path, error: err instanceof Error ? err.message : String(err), attempt });
      }
    }
  }

  /*
   * A top-level post over the run's word cap fails here, before it's sent
   * (docs/17-executive-team.md §21.2): the cap lives in the agents' client,
   * not the message model or the chat API, and a reply is never capped.
   */
  private overWordCap(text: string): TeamChatCallResult | undefined {
    const cap = this.config.TEAM_CHAT_POST_WORDS;
    const words = countWords(text);
    if (cap === 0 || words <= cap) return undefined;
    logWarn("TeamChatClient.overWordCap", { words, cap });
    return { status: 400, body: { message: `A top-level post is at most ${cap} words; this one is ${words}. Shorten it and put the detail in a thread reply.` } };
  }

  private messagePath(channelId: string, messageId?: string): string {
    const base = `/channels/${encodeURIComponent(channelId)}/messages`;
    return messageId ? `${base}/${encodeURIComponent(messageId)}` : base;
  }

  listChannels(): Promise<TeamChatCallResult> {
    return this.call("GET", "/channels");
  }

  readChannel(channelId: string, query: { after?: string; before?: string; limit?: number }): Promise<TeamChatCallResult> {
    return this.call("GET", `${this.messagePath(channelId)}${queryString(query)}`);
  }

  readThread(channelId: string, messageId: string): Promise<TeamChatCallResult> {
    return this.call("GET", `${this.messagePath(channelId, messageId)}/thread`);
  }

  readInbox(query: { after?: string; limit?: number }): Promise<TeamChatCallResult> {
    return this.call("GET", `/inbox${queryString(query)}`, { auth: true });
  }

  markInboxRead(entryId: string): Promise<TeamChatCallResult> {
    return this.call("PUT", "/inbox/read", { body: { entry_id: entryId }, auth: true });
  }

  async postMessage(channelId: string, text: string, tags: string[]): Promise<TeamChatCallResult> {
    const tooLong = this.overWordCap(text);
    if (tooLong) return tooLong;
    return this.call("POST", this.messagePath(channelId), { body: { text, tags, client_token: this.newToken() }, auth: true, retries: WRITE_RETRIES });
  }

  reply(channelId: string, messageId: string, text: string, tags: string[]): Promise<TeamChatCallResult> {
    return this.call("POST", `${this.messagePath(channelId, messageId)}/replies`, { body: { text, tags, client_token: this.newToken() }, auth: true, retries: WRITE_RETRIES });
  }

  async editMessage(channelId: string, messageId: string, threadId: string | undefined, text: string): Promise<TeamChatCallResult> {
    const tooLong = threadId ? undefined : this.overWordCap(text);
    if (tooLong) return tooLong;
    const suffix = threadId ? `?thread_id=${encodeURIComponent(threadId)}` : "";
    return this.call("PATCH", `${this.messagePath(channelId, messageId)}${suffix}`, { body: { text }, auth: true });
  }

  react(channelId: string, messageId: string, threadId: string | undefined, emoji: string, remove: boolean): Promise<TeamChatCallResult> {
    const suffix = threadId ? `?thread_id=${encodeURIComponent(threadId)}` : "";
    return this.call(remove ? "DELETE" : "PUT", `${this.messagePath(channelId, messageId)}/reactions/${encodeURIComponent(emoji)}${suffix}`, { auth: true, retries: WRITE_RETRIES });
  }
}
