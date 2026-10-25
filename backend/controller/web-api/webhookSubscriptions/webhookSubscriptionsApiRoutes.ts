/* The webhookSubscriptions bundle's route keys (15-resource-consolidation.md §4.2). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const WEBHOOK_SUBSCRIPTIONS_API_ROUTES = [
  "POST /webhook-subscriptions",
] as const;

export type WebhookSubscriptionsApiRouteKey = (typeof WEBHOOK_SUBSCRIPTIONS_API_ROUTES)[number];
