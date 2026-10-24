import { z } from "zod";

/*
 * The slice of an API Gateway HTTP API (v2) event a Service API router
 * needs (`15-resource-consolidation.md` §4.3): the route key to dispatch
 * on, and the JWT claims an admin router checks before dispatching. The
 * per-route controller still parses the full event through
 * `ApiGatewayHttpEventSchema` itself. Lenient beyond these fields, like
 * that schema.
 */
export const ApiRouterEventSchema = z.object({
  routeKey: z.string().min(1),
  requestContext: z.object({
    authorizer: z
      .object({
        jwt: z.object({
          claims: z.record(z.string(), z.string()),
        }),
      })
      .optional(),
  }),
});

export type ApiRouterEvent = z.infer<typeof ApiRouterEventSchema>;
