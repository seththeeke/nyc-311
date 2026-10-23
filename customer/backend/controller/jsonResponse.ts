import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const JSON_CONTENT_TYPE_HEADER = { "Content-Type": "application/json" };

/**
 * Shared response builder for customer/backend's API-Gateway-facing
 * controllers (`webhook/`, `read/`) — extracted from two byte-identical
 * copies of this function (CLAUDE.md §5.2's logging/structure rules apply
 * here too, even without a dedicated DAO). `extraHeaders` lets a caller
 * add its own response headers (e.g. `read/`'s `Cache-Control`) without
 * redefining the helper.
 */
export function jsonResponse(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: { ...JSON_CONTENT_TYPE_HEADER, ...extraHeaders }, body: JSON.stringify(body) };
}
