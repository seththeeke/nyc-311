/* The webhookSink bundle's route keys (15-resource-consolidation.md §4.2). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const WEBHOOK_SINK_API_ROUTES = [
  "POST /webhook-sink",
  "GET /webhook-sink/deliveries",
] as const;

export type WebhookSinkApiRouteKey = (typeof WEBHOOK_SINK_API_ROUTES)[number];
