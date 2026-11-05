import { z } from "zod";

/*
 * The admin pool's Cognito groups (docs/17-executive-team.md §12.2, §17.2). A user
 * may hold several; the JWT's `cognito:groups` claim lists them all.
 */
export const COGNITO_GROUPS = ["ADMIN", "BOROUGH_SIM_TEAM", "BOROUGH_SIM_OPERATIONS", "BOROUGH_SIM_PRODUCT"] as const;
export const CognitoGroupSchema = z.enum(COGNITO_GROUPS);
export type CognitoGroup = z.infer<typeof CognitoGroupSchema>;

export const COGNITO_GROUPS_CLAIM = "cognito:groups";

/**
 * Reads the groups claim as API Gateway hands it over: the HTTP API JWT
 * authorizer flattens the token's array to a string such as
 * `[ADMIN BOROUGH_SIM_TEAM]`. Unknown group names are dropped.
 */
export function parseCognitoGroups(claim: string | undefined): CognitoGroup[] {
  if (!claim) return [];
  return claim
    .replace(/^\[|\]$/g, "")
    .split(/[\s,]+/)
    .flatMap((name) => {
      const parsed = CognitoGroupSchema.safeParse(name);
      return parsed.success ? [parsed.data] : [];
    });
}
