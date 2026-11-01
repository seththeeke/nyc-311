import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { listPublicChannels } from "../../../service/teamChat/teamChatService";
import { handleTeamChat } from "./teamChatRequest";

/** `GET /channels`: every public channel (docs/17-executive-team.md §10.4). Open. */
export const listChannelsController = (event: unknown): Promise<APIGatewayProxyStructuredResultV2> =>
  handleTeamChat("ListChannelsController", event, async () => ({ status: 200, body: { items: await listPublicChannels() }, cacheable: true }));
