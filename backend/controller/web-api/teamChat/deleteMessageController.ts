import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { deleteMessage } from "../../../service/teamChat/teamChatService";
import { callerOf, handleTeamChat, pathParam, threadIdOf } from "./teamChatRequest";

/** `DELETE /channels/{channel_id}/messages/{message_id}`: tombstones the caller's own message; `?thread_id=` for a reply. */
export const deleteMessageController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("DeleteMessageController", event, async (parsed) => {
    await deleteMessage(await callerOf(parsed), pathParam(parsed, "channel_id"), pathParam(parsed, "message_id"), threadIdOf(parsed));
    return { status: 204 };
  });
