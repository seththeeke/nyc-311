import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiRouterEventSchema } from "../../../models/apiRouterEvent";
import type { ApiController } from "../shared/createApiRouter";
import { jsonResponse } from "../shared/jsonResponse";
import { requireGroup } from "../shared/requireGroup";
import { deleteMessageController } from "./deleteMessageController";
import { deleteReactionController } from "./deleteReactionController";
import { editMessageController } from "./editMessageController";
import { getChannelMessagesController } from "./getChannelMessagesController";
import { getInboxController } from "./getInboxController";
import { getThreadController } from "./getThreadController";
import { listChannelsController } from "./listChannelsController";
import { markInboxReadController } from "./markInboxReadController";
import { postMessageController } from "./postMessageController";
import { postReplyController } from "./postReplyController";
import { putReactionController } from "./putReactionController";
import { TEAM_CHAT_MEMBER_ROUTES, type TeamChatApiRouteKey } from "./teamChatApiRoutes";

/* Typed on the route-key union, so a route with no controller (or a controller with no route) fails to compile. */
const TEAM_CHAT_CONTROLLERS: Record<TeamChatApiRouteKey, ApiController> = {
  "GET /channels": listChannelsController,
  "GET /channels/{channel_id}/messages": getChannelMessagesController,
  "GET /channels/{channel_id}/messages/{message_id}/thread": getThreadController,
  "POST /channels/{channel_id}/messages": postMessageController,
  "POST /channels/{channel_id}/messages/{message_id}/replies": postReplyController,
  "PATCH /channels/{channel_id}/messages/{message_id}": editMessageController,
  "DELETE /channels/{channel_id}/messages/{message_id}": deleteMessageController,
  "PUT /channels/{channel_id}/messages/{message_id}/reactions/{emoji}": putReactionController,
  "DELETE /channels/{channel_id}/messages/{message_id}/reactions/{emoji}": deleteReactionController,
  "GET /inbox": getInboxController,
  "PUT /inbox/read": markInboxReadController,
};

const isRouteKey = (routeKey: string): routeKey is TeamChatApiRouteKey => Object.hasOwn(TEAM_CHAT_CONTROLLERS, routeKey);
const isMemberRoute = (routeKey: TeamChatApiRouteKey): boolean => (TEAM_CHAT_MEMBER_ROUTES as readonly string[]).includes(routeKey);

/**
 * The Team Chat API's handler (docs/17-executive-team.md §10.4). Reads
 * dispatch straight through. A member route must carry JWT claims (a
 * missing authorizer is a misconfiguration, so 500) and the
 * BOROUGH_SIM_TEAM group (403 otherwise) before its controller runs.
 */
export const teamChatApiRouter = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  const parsed = ApiRouterEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("TeamChatApiRouterValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }
  const { routeKey, requestContext } = parsed.data;
  if (!isRouteKey(routeKey)) {
    logError("TeamChatApiRouterUnknownRoute", { routeKey });
    return jsonResponse(404, { message: "Not found" });
  }
  if (isMemberRoute(routeKey)) {
    const claims = requestContext.authorizer?.jwt.claims;
    if (!claims) {
      logError("TeamChatApiRouterMissingClaims", { routeKey });
      return jsonResponse(500, { message: "Internal server error" });
    }
    if (!requireGroup(claims, ["BOROUGH_SIM_TEAM"], routeKey)) return jsonResponse(403, { message: "Forbidden" });
  }
  logInfo("TeamChatApiRouterDispatch", { routeKey });
  const response = await TEAM_CHAT_CONTROLLERS[routeKey](event);
  logInfo("TeamChatApiRouterCompleted", { routeKey, statusCode: response.statusCode });
  return response;
};
