import type { ZodIssue } from "zod";
import type { PublicApiErrorCode, PublicApiErrorDetail } from "../../../models/publicApi/publicApiError";
import type { PublicApiResult, PublicApiUsage } from "../../../models/publicApi/publicApiCall";

/* Usage for a call that records nothing beyond its outcome. */
export const NO_USAGE: PublicApiUsage = { request_params: null, result_count: null, resource_id: null };

/** A success result in the public shape (16-resident-action-models.md §2.2). */
export function publicResult(statusCode: number, body: unknown, usage: PublicApiUsage = NO_USAGE): PublicApiResult {
  return { status_code: statusCode, body, usage };
}

/** An error result in the public error shape. `details` only for VALIDATION_ERROR. */
export function publicError(
  statusCode: number,
  code: PublicApiErrorCode,
  message: string,
  details?: PublicApiErrorDetail[],
  usage: PublicApiUsage = NO_USAGE
): PublicApiResult {
  return { status_code: statusCode, body: { error: { code, message, ...(details ? { details } : {}) } }, usage };
}

/** zod issues as public `details`, one per failing field; `prefix` names the part of the request. */
export function issuesToDetails(issues: ZodIssue[], prefix?: string): PublicApiErrorDetail[] {
  return issues.map((issue) => {
    const path = issue.path.join(".");
    const field = [prefix, path].filter((part) => part).join(".") || "body";
    return { field, issue: issue.message };
  });
}
