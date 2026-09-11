import { getOrCreateUser } from "../../service/user/userService";
import type { ApiGatewayHttpEvent } from "../../models/apiGatewayHttpEvent";
import type { User } from "../../models/user";
import { TerminalError } from "../../models/errors";

/**
 * Shared first-step for every admin-only controller
 * (`9-admin-auth-integration.md` §5, §4) — call immediately after parsing
 * the raw event through `ApiGatewayHttpEventSchema`. Extracts the JWT
 * authorizer's claims (already validated by API Gateway before this
 * Lambda ran) and resolves them to a real `User` via
 * `getOrCreateUser`, so every admin action has a `user_id` to attribute.
 *
 * @throws {@link TerminalError} if `sub`/`email` claims are missing — this
 * should be unreachable on a route actually behind the JWT authorizer
 * (API Gateway rejects the request before invoking the Lambda otherwise),
 * so its absence here indicates an authorizer misconfiguration, not a bad
 * caller input. Controllers map it to `500`, not `400`.
 */
export async function requireAdminUser(event: ApiGatewayHttpEvent): Promise<User> {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  const email = claims?.email;
  if (!sub || !email) {
    throw new TerminalError("Missing sub/email claims on an admin-authorized route");
  }
  return getOrCreateUser(sub, email);
}
