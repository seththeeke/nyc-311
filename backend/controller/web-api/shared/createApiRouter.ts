import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiRouterEventSchema } from "../../../models/apiRouterEvent";
import { jsonResponse } from "./jsonResponse";

export type ApiController = (event: unknown) => Promise<APIGatewayProxyStructuredResultV2>;

/**
 * Builds a public Service API bundle's handler (`15-resource-consolidation.md`
 * §4.3): dispatch on `routeKey` and nothing else. The route's controller
 * gets the raw event and parses and logs it in full, as before. An unknown
 * key is a CDK/route-list mismatch, so it 404s rather than guessing.
 *
 * @param bundleName PascalCase prefix for the router's log events, e.g. `DataApi`.
 * @param controllers Typed on the bundle's route-key union, so a missing or extra entry fails to compile.
 */
export function createApiRouter<TRouteKey extends string>(
  bundleName: string,
  controllers: Record<TRouteKey, ApiController>
): ApiController {
  const isRouteKey = (routeKey: string): routeKey is TRouteKey => Object.hasOwn(controllers, routeKey);

  return async (event) => {
    const parsedEvent = ApiRouterEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      logError(`${bundleName}RouterValidationFailed`, { issues: parsedEvent.error.issues });
      return jsonResponse(400, { message: "Malformed request" });
    }

    const { routeKey } = parsedEvent.data;
    if (!isRouteKey(routeKey)) {
      logError(`${bundleName}RouterUnknownRoute`, { routeKey });
      return jsonResponse(404, { message: "Not found" });
    }

    logInfo(`${bundleName}RouterDispatch`, { routeKey });
    const response = await controllers[routeKey](event);
    logInfo(`${bundleName}RouterCompleted`, { routeKey, statusCode: response.statusCode });
    return response;
  };
}
