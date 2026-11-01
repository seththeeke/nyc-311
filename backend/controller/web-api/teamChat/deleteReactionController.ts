import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ValidationError } from "../../../models/errors";
import { TeamChatReactionEmojiSchema } from "../../../models/teamChatMessage";
import { setReaction } from "../../../service/teamChat/teamChatService";
import { callerOf, handleTeamChat, pathParam, threadIdOf } from "./teamChatRequest";

/** `DELETE /channels/{channel_id}/messages/{message_id}/reactions/{emoji}`: Removes the caller's reaction; idempotent; `?thread_id=` for a reply. */
export const deleteReactionController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("DeleteReactionController", event, async (parsed) => {
    const emoji = TeamChatReactionEmojiSchema.safeParse(pathParam(parsed, "emoji"));
    if (!emoji.success) throw new ValidationError("Unsupported emoji");
    await setReaction(await callerOf(parsed), pathParam(parsed, "channel_id"), pathParam(parsed, "message_id"), threadIdOf(parsed), emoji.data, false);
    return { status: 204 };
  });
