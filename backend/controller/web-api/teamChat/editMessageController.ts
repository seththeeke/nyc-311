import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { TeamChatEditBodySchema } from "../../../models/teamChatMessage";
import { editMessage } from "../../../service/teamChat/teamChatService";
import { bodyOf, callerOf, handleTeamChat, pathParam, threadIdOf } from "./teamChatRequest";

/** `PATCH /channels/{channel_id}/messages/{message_id}`: edits the caller's own message; `?thread_id=` for a reply. */
export const editMessageController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("EditMessageController", event, async (parsed) => {
    const body = bodyOf(parsed, TeamChatEditBodySchema);
    return { status: 200, body: await editMessage(await callerOf(parsed), pathParam(parsed, "channel_id"), pathParam(parsed, "message_id"), threadIdOf(parsed), body) };
  });
