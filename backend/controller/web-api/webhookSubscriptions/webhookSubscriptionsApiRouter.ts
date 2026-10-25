import { createApiRouter } from "../shared/createApiRouter";
import type { WebhookSubscriptionsApiRouteKey } from "./webhookSubscriptionsApiRoutes";
import { registerWebhookSubscriptionController } from "./registerWebhookSubscriptionController";

/** The webhookSubscriptions Service API bundle's Lambda handler (15-resource-consolidation.md §3.3). */
export const webhookSubscriptionsApiRouter = createApiRouter<WebhookSubscriptionsApiRouteKey>("WebhookSubscriptionsApi", {
  "POST /webhook-subscriptions": registerWebhookSubscriptionController,
});
