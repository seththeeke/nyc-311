import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { TeamChatInboxReadBodySchema } from "../../../models/teamChatInboxEntry";
import { markInboxRead } from "../../../service/teamChat/teamChatService";
import { bodyOf, callerOf, handleTeamChat } from "./teamChatRequest";

/** `PUT /inbox/read`: advances the caller's inbox read cursor to `{ entry_id }`. */
export const markInboxReadController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("MarkInboxReadController", event, async (parsed) => {
    const body = bodyOf(parsed, TeamChatInboxReadBodySchema);
    await markInboxRead(await callerOf(parsed), body.entry_id);
    return { status: 204 };
  });
