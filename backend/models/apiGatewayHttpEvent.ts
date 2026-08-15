import { z } from "zod";

// The minimal shape of an API Gateway HTTP API (v2) proxy-integration event
// that a controller/web-api handler actually needs, per CLAUDE.md §5.2 —
// every controller validates its raw trigger payload through a zod schema
// before it reaches a service, even when (as with the first route) no field
// drives branching logic yet. Deliberately lenient beyond these fields
// (no `.strict()`) since API Gateway's real event carries many more
// properties this project doesn't use yet.

export const ApiGatewayHttpEventSchema = z.object({
  rawPath: z.string().min(1),
  requestContext: z.object({
    http: z.object({
      method: z.string().min(1),
    }),
  }),
  queryStringParameters: z.record(z.string(), z.string()).nullable().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().nullable().optional(),
});

export type ApiGatewayHttpEvent = z.infer<typeof ApiGatewayHttpEventSchema>;
