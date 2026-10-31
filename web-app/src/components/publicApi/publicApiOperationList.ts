/* What the Overview shows per operation (16-resident-action-models.md §2.4). The spec is the contract; this is the pitch. */
export interface PublicApiOperation {
  name: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
  /** Builds the copy-paste example against a base URL. */
  curl: (baseUrl: string) => string;
}

const REQUESTER = "-H 'X-Requester: your-app'";

export const PUBLIC_API_OPERATIONS: PublicApiOperation[] = [
  {
    name: "Search requests",
    method: "POST",
    path: "/v1/requests/search",
    summary: "Look up a 311 complaint by its order id: where it is, whether it's scheduled, and when.",
    curl: (baseUrl) =>
      `curl -X POST ${baseUrl}/v1/requests/search \\\n  ${REQUESTER} -H 'Content-Type: application/json' \\\n  -d '{"search_params":{"order_id":"01K7XWQ2B9N4M8F3T6RZ0Y5DKA"}}'`,
  },
  {
    name: "Create a feature request",
    method: "POST",
    path: "/v1/feature-requests",
    summary: "Ask BoroughSim for something it doesn't do yet. Send an Idempotency-Key so a retry never files twice.",
    curl: (baseUrl) =>
      `curl -X POST ${baseUrl}/v1/feature-requests \\\n  ${REQUESTER} -H 'Content-Type: application/json' \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -d '{"title":"Text me when work is booked","description":"Let me subscribe to a street.","submitted_by":{"name":"Ada"}}'`,
  },
  {
    name: "Get a feature request",
    method: "GET",
    path: "/v1/feature-requests/{feature_request_id}",
    summary: "Check on a feature request you filed: received, under review, or closed, and why.",
    curl: (baseUrl) => `curl ${baseUrl}/v1/feature-requests/01K8C4T1W7H3P9N2M6QZ8V0RJD \\\n  ${REQUESTER}`,
  },
];
