import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { getInbox } from "../../../service/teamChat/teamChatService";
import { callerOf, handleTeamChat, pageQueryOf } from "./teamChatRequest";

/** `GET /inbox`: the caller's mentions and thread replies, oldest first, after their read cursor or `?after=`. */
export const getInboxController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("GetInboxController", event, async (parsed) => ({ status: 200, body: await getInbox(await callerOf(parsed), pageQueryOf(parsed)) }));
