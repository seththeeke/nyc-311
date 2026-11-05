import { COGNITO_GROUPS_CLAIM, parseCognitoGroups } from "../../../models/cognitoGroup";
import type { ApiGatewayHttpEvent } from "../../../models/apiGatewayHttpEvent";

/**
 * True for an agent on an admin route it's allowed (docs/17-executive-team.md
 * §17.2): in an agent group but not ADMIN. An agent isn't resolved to a
 * User row; only the admin is.
 */
export function isAgentCaller(event: ApiGatewayHttpEvent): boolean {
  const groups = parseCognitoGroups(event.requestContext.authorizer?.jwt.claims[COGNITO_GROUPS_CLAIM]);
  return !groups.includes("ADMIN") && (groups.includes("BOROUGH_SIM_OPERATIONS") || groups.includes("BOROUGH_SIM_PRODUCT"));
}
