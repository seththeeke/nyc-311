import { COGNITO_GROUPS_CLAIM, parseCognitoGroups } from "../../../models/cognitoGroup";
import type { ApiGatewayHttpEvent } from "../../../models/apiGatewayHttpEvent";
import type { CapacityChange } from "../../../models/capacityChange";
import { TerminalError, ValidationError } from "../../../models/errors";
import { requireAdminUser } from "./requireAdminUser";

/**
 * Who is changing capacity (docs/17-executive-team.md §12.2). The admin is
 * resolved to a User as before. An OPERATIONS caller (the COO) is an
 * agent: it must give a reason, and the service caps its changes.
 *
 * @throws {@link ValidationError} for an agent with no reason.
 */
export async function capacityChangeOf(event: ApiGatewayHttpEvent, reason: string | undefined, resolveAdmin: (event: ApiGatewayHttpEvent) => Promise<unknown> = requireAdminUser): Promise<CapacityChange> {
  const claims = event.requestContext.authorizer?.jwt.claims ?? {};
  const email = claims.email;
  if (!email) throw new TerminalError("Missing email claim on a capacity route");
  if (parseCognitoGroups(claims[COGNITO_GROUPS_CLAIM]).includes("ADMIN")) {
    await resolveAdmin(event);
    return { actor: "ADMIN", reason: reason ?? null, by: email };
  }
  if (!reason) throw new ValidationError("An agent must give a reason for a capacity change");
  return { actor: "AGENT", reason, by: email };
}

/** For a capacity read: resolves the admin to a User as before; an agent reads without one. */
export async function requireCapacityReader(event: ApiGatewayHttpEvent, resolveAdmin: (event: ApiGatewayHttpEvent) => Promise<unknown> = requireAdminUser): Promise<void> {
  const claims = event.requestContext.authorizer?.jwt.claims ?? {};
  if (parseCognitoGroups(claims[COGNITO_GROUPS_CLAIM]).includes("ADMIN")) await resolveAdmin(event);
}
