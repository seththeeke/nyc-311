import { COGNITO_GROUPS_CLAIM, parseCognitoGroups, type CognitoGroup } from "../../../models/cognitoGroup";
import type { ApiGatewayHttpEvent } from "../../../models/apiGatewayHttpEvent";

/* The groups that give an agent admin routes; BOROUGH_SIM_TEAM alone gives none. */
const AGENT_ROUTE_GROUPS: readonly CognitoGroup[] = ["BOROUGH_SIM_OPERATIONS", "BOROUGH_SIM_PRODUCT", "BOROUGH_SIM_ENGINEERING"];

/**
 * True for an agent on an admin route it's allowed (docs/17-executive-team.md
 * §17.2): in an agent group but not ADMIN. An agent isn't resolved to a
 * User row; only the admin is.
 */
export function isAgentCaller(event: ApiGatewayHttpEvent): boolean {
  const groups = parseCognitoGroups(event.requestContext.authorizer?.jwt.claims[COGNITO_GROUPS_CLAIM]);
  return !groups.includes("ADMIN") && groups.some((group) => AGENT_ROUTE_GROUPS.includes(group));
}
