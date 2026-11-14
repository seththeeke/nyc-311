import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { UpdateContactInputSchema, UpdateContactParamsSchema } from "../../../models/contactUpdate";
import { toContactListItem, updateContact } from "../../../service/contact/contactService";
import { jsonResponse } from "../shared/jsonResponse";
import { errorResponse } from "../shared/errorResponse";

/** `PATCH /admin/contacts/{contact_id}` (17-executive-team.md §17.3): ADMIN or BOROUGH_SIM_PRODUCT (the CPO). */
export const updateContactController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("UpdateContactControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("UpdateContactControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }
  const params = UpdateContactParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!params.success) {
    logError("UpdateContactControllerParamsInvalid", { issues: params.error.issues });
    return jsonResponse(400, { message: "Missing contact_id path parameter" });
  }
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(parsedEvent.data.body ?? "");
  } catch {
    logError("UpdateContactControllerBodyParseFailed", {});
    return jsonResponse(400, { message: "Malformed JSON body" });
  }
  const body = UpdateContactInputSchema.safeParse(rawBody);
  if (!body.success) {
    logError("UpdateContactControllerBodyInvalid", { issues: body.error.issues });
    return jsonResponse(400, { message: "Invalid contact update", issues: body.error.issues });
  }
  const by = parsedEvent.data.requestContext.authorizer?.jwt.claims.email ?? "unknown";

  try {
    const contact = await updateContact(params.data.contact_id, body.data, by);
    logInfo("UpdateContactControllerCompleted", { contactId: contact.contact_id, status: contact.status });
    return jsonResponse(200, toContactListItem(contact));
  } catch (err) {
    logError("UpdateContactControllerFailed", { contactId: params.data.contact_id, error: err instanceof Error ? err.message : err });
    return errorResponse(err, "Failed to update contact");
  }
};
