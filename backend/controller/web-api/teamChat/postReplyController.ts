import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { TeamChatPostBodySchema } from "../../../models/teamChatMessage";
import { postReply } from "../../../service/teamChat/teamChatService";
import { bodyOf, callerOf, handleTeamChat, pathParam } from "./teamChatRequest";

/** `POST /channels/{channel_id}/messages/{message_id}/replies`: replies in the thread as the caller. */
export const postReplyController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("PostReplyController", event, async (parsed) => {
    const body = bodyOf(parsed, TeamChatPostBodySchema);
    const result = await postReply(await callerOf(parsed), pathParam(parsed, "channel_id"), pathParam(parsed, "message_id"), body);
    return { status: result.replayed ? 200 : 201, body: result.message };
  });
