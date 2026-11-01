import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { TeamChatPostBodySchema } from "../../../models/teamChatMessage";
import { postMessage } from "../../../service/teamChat/teamChatService";
import { bodyOf, callerOf, handleTeamChat, pathParam } from "./teamChatRequest";

/** `POST /channels/{channel_id}/messages`: posts as the caller; 201 new, 200 on a replayed client_token. */
export const postMessageController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("PostMessageController", event, async (parsed) => {
    const body = bodyOf(parsed, TeamChatPostBodySchema);
    const result = await postMessage(await callerOf(parsed), pathParam(parsed, "channel_id"), body);
    return { status: result.replayed ? 200 : 201, body: result.message };
  });
