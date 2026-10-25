import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Shared response builder for every `controller/web-api/*` handler —
 * extracted from 29 byte-identical copies of this same function so the
 * JSON content-type header has one place to change.
 */
export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}
