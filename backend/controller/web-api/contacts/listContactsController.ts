import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { ListContactsQuerySchema } from "../../../models/contactList";
import { ValidationError } from "../../../models/errors";
import { listContacts } from "../../../service/contact/contactService";
import { jsonResponse } from "../shared/jsonResponse";

/** `GET /contacts` (17-executive-team.md §17.3), public: one page of Contacts by type, optionally by status. */
export const listContactsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ListContactsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("ListContactsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }
  const query = ListContactsQuerySchema.safeParse(parsedEvent.data.queryStringParameters ?? {});
  if (!query.success) {
    logError("ListContactsControllerQueryInvalid", { issues: query.error.issues });
    return jsonResponse(400, { message: "Invalid query", issues: query.error.issues });
  }

  try {
    const page = await listContacts(query.data);
    const response = jsonResponse(200, page);
    logInfo("ListContactsControllerCompleted", { status: 200, count: page.contacts.length });
    return response;
  } catch (err) {
    if (err instanceof ValidationError) {
      logError("ListContactsControllerBadCursor", { error: err.message });
      return jsonResponse(400, { message: err.message });
    }
    logError("ListContactsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to list contacts" });
  }
};
