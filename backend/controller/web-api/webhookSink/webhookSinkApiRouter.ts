import { createApiRouter } from "../shared/createApiRouter";
import type { WebhookSinkApiRouteKey } from "./webhookSinkApiRoutes";
import { getWebhookSinkDeliveriesController } from "./getWebhookSinkDeliveriesController";
import { receiveWebhookSinkController } from "./receiveWebhookSinkController";

/** The webhookSink Service API bundle's Lambda handler (15-resource-consolidation.md §3.3). */
export const webhookSinkApiRouter = createApiRouter<WebhookSinkApiRouteKey>("WebhookSinkApi", {
  "POST /webhook-sink": receiveWebhookSinkController,
  "GET /webhook-sink/deliveries": getWebhookSinkDeliveriesController,
});
