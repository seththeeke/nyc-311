import { logWarn } from "../../../logger";
import { COGNITO_GROUPS_CLAIM, parseCognitoGroups, type CognitoGroup } from "../../../models/cognitoGroup";

/**
 * True when the caller's JWT claims hold at least one of `allowed`
 * (docs/17-executive-team.md §12.2). Every JWT-authorized route checks
 * this before its controller runs; a valid token alone grants nothing.
 */
export function requireGroup(claims: Record<string, string>, allowed: readonly CognitoGroup[], routeKey: string): boolean {
  const held = parseCognitoGroups(claims[COGNITO_GROUPS_CLAIM]);
  const permitted = held.some((group) => allowed.includes(group));
  if (!permitted) {
    logWarn("RequireGroupDenied", { routeKey, held, allowed: [...allowed] });
  }
  return permitted;
}
