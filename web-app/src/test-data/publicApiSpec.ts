/* A trimmed copy of the public API spec, so the Reference renders in in-memory mode. The real one is served by the API. */
export const MOCK_PUBLIC_API_SPEC = `openapi: 3.1.0
info:
  title: BoroughSim Public API (sample)
  version: "1.0.0"
  description: In-memory sample. The live page loads the spec from the API itself.
paths:
  /v1/feature-requests/{feature_request_id}:
    get:
      summary: Get a feature request
      parameters:
        - name: X-Requester
          in: header
          required: true
          schema:
            type: string
        - name: feature_request_id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The feature request.
`;
