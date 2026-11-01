import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { getThread } from "../../../service/teamChat/teamChatService";
import { handleTeamChat, pageQueryOf, pathParam } from "./teamChatRequest";

/** `GET /channels/{channel_id}/messages/{message_id}/thread`: the root and its replies, oldest first. Open. */
export const getThreadController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("GetThreadController", event, async (parsed) => ({
    status: 200,
    body: await getThread(pathParam(parsed, "channel_id"), pathParam(parsed, "message_id"), pageQueryOf(parsed)),
    cacheable: true,
  }));
