import { createApiRouter } from "../shared/createApiRouter";
import type { ContactsApiRouteKey } from "./contactsApiRoutes";
import { listContactsController } from "./listContactsController";

/** The contacts Service API bundle's Lambda handler (17-executive-team.md §17.3). */
export const contactsApiRouter = createApiRouter<ContactsApiRouteKey>("ContactsApi", {
  "GET /contacts": listContactsController,
});
