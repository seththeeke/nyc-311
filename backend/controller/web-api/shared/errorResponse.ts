import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, UnauthorizedError, ValidationError } from "../../../models/errors";
import { jsonResponse } from "./jsonResponse";

type ErrorType = new (...args: never[]) => Error;

/**
 * One route's exception to {@link ERROR_STATUS}: `type` answers `status`,
 * with `message` in place of the error's own when given.
 */
export interface ErrorOverride {
  type: ErrorType;
  status: number;
  message?: string;
}

/**
 * The typed errors' HTTP statuses (`models/errors.ts`), shared by every
 * web-api bundle except `publicV1/` (its own spec) and `teamChat/`.
 * `TerminalError` is absent on purpose: it is a 500 unless a route overrides it.
 */
const ERROR_STATUS: readonly [ErrorType, number][] = [
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [RateLimitedError, 429],
];

/**
 * Maps a controller's caught error to its response: a route override first,
 * then a typed error's status with its own message, else a 500 with the
 * route's `fallbackMessage`.
 */
export function errorResponse(err: unknown, fallbackMessage: string, overrides: readonly ErrorOverride[] = []): APIGatewayProxyStructuredResultV2 {
  const override = overrides.find(({ type }) => err instanceof type);
  if (override) {
    return jsonResponse(override.status, { message: override.message ?? (err as Error).message });
  }
  const status = ERROR_STATUS.find(([type]) => err instanceof type)?.[1];
  if (status !== undefined) {
    return jsonResponse(status, { message: (err as Error).message });
  }
  return jsonResponse(500, { message: fallbackMessage });
}
