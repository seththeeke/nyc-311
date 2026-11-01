/*
 * The Team Chat API's route keys (docs/17-executive-team.md §10.4). Imports
 * nothing: cdk/teamChat/ imports it. Internal and unversioned. Reads are
 * open; member routes sit behind the JWT authorizer.
 */
export const TEAM_CHAT_READ_ROUTES = [
  "GET /channels",
  "GET /channels/{channel_id}/messages",
  "GET /channels/{channel_id}/messages/{message_id}/thread",
] as const;

export const TEAM_CHAT_MEMBER_ROUTES = [
  "POST /channels/{channel_id}/messages",
  "POST /channels/{channel_id}/messages/{message_id}/replies",
  "PATCH /channels/{channel_id}/messages/{message_id}",
  "DELETE /channels/{channel_id}/messages/{message_id}",
  "PUT /channels/{channel_id}/messages/{message_id}/reactions/{emoji}",
  "DELETE /channels/{channel_id}/messages/{message_id}/reactions/{emoji}",
  "GET /inbox",
  "PUT /inbox/read",
] as const;

export const TEAM_CHAT_API_ROUTES = [...TEAM_CHAT_READ_ROUTES, ...TEAM_CHAT_MEMBER_ROUTES] as const;

export type TeamChatReadRouteKey = (typeof TEAM_CHAT_READ_ROUTES)[number];
export type TeamChatMemberRouteKey = (typeof TEAM_CHAT_MEMBER_ROUTES)[number];
export type TeamChatApiRouteKey = TeamChatReadRouteKey | TeamChatMemberRouteKey;
