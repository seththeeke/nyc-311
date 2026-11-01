import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { getTimeline } from "../../../service/teamChat/teamChatService";
import { handleTeamChat, pageQueryOf, pathParam } from "./teamChatRequest";

/** `GET /channels/{channel_id}/messages`: the timeline, newest first; `after` polls for what's new. Open. */
export const getChannelMessagesController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("GetChannelMessagesController", event, async (parsed) => ({
    status: 200,
    body: await getTimeline(pathParam(parsed, "channel_id"), pageQueryOf(parsed)),
    cacheable: true,
  }));
