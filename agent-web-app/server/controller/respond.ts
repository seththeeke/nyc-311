import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, ZodTypeAny, output } from "zod";
import { logError, logInfo, logWarn } from "../logger.ts";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../models/errors.ts";

/** Parses route input; a bad value is a ValidationError (400), never a raw ZodError. */
export function parseInput<S extends ZodTypeAny>(schema: S, value: unknown): output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return result.data as output<S>;
}

function statusOf(error: unknown): number {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ValidationError) return 400;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof ConflictError) return 409;
  return 500;
}

/**
 * Runs one route: logs the request, validates the response against the
 * shared schema before sending (a drifted shape fails here as a 500, not in
 * the UI), and maps typed errors to status codes.
 */
export async function respond<T>(request: FastifyRequest, reply: FastifyReply, schema: ZodType<T>, handler: () => Promise<T>): Promise<void> {
  logInfo("request", { method: request.method, url: request.url });
  try {
    const body = schema.parse(await handler());
    logInfo("response", { url: request.url, status: 200 });
    await reply.code(200).send(body);
  } catch (error) {
    const status = statusOf(error);
    const message = error instanceof Error ? error.message : String(error);
    (status === 500 ? logError : logWarn)("request failed", { url: request.url, status, message });
    await reply.code(status).send({ error: message });
  }
}
