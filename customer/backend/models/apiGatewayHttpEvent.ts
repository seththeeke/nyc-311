import { z } from "zod";

/*
 * The minimal shape of an API Gateway HTTP API (v2) proxy event a
 * controller needs. Lenient beyond these fields. Copied from
 * `backend/models/apiGatewayHttpEvent.ts`, never imported (CLAUDE.md §5.4).
 */

export const ApiGatewayHttpEventSchema = z.object({
  rawPath: z.string().min(1),
  /* e.g. `GET /residents/{personaId}` — names the matched route, so one Lambda can serve several. */
  routeKey: z.string().min(1).optional(),
  requestContext: z.object({
    http: z.object({
      method: z.string().min(1),
    }),
    /*
     * Present only on routes behind the JWT authorizer
     * (`9-admin-auth-integration.md` §4) — API Gateway populates this after
     * validating the token, before the Lambda ever runs. `claims` carries
     * whatever the Cognito ID/access token's claims include (`sub`,
     * `email`, ...) as plain strings.
     */
    authorizer: z
      .object({
        jwt: z.object({
          claims: z.record(z.string(), z.string()),
          scopes: z.array(z.string()).nullable().optional(),
        }),
      })
      .optional(),
  }),
  queryStringParameters: z.record(z.string(), z.string()).nullable().optional(),
  pathParameters: z.record(z.string(), z.string()).nullable().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().nullable().optional(),
});

export type ApiGatewayHttpEvent = z.infer<typeof ApiGatewayHttpEventSchema>;
