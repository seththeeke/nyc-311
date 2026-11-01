import { config } from "../config";
import { MOCK_PUBLIC_API_SPEC } from "../test-data/publicApiSpec";

/* The X-Requester this page sends; it shows in public_api_calls like any client. */
export const DOCS_REQUESTER = "web-app:docs";

/* The public API's OpenAPI document as YAML text, for the Reference section (16-resident-action-models.md §6.2). */
export interface PublicApiSpecService {
  getSpecYaml(): Promise<string>;
}

class LivePublicApiSpecService implements PublicApiSpecService {
  async getSpecYaml(): Promise<string> {
    const response = await fetch(`${config.publicApiBaseUrl}/v1/openapi.yaml`, { headers: { "X-Requester": DOCS_REQUESTER } });
    if (!response.ok) {
      throw new Error(`Failed to fetch the public API spec: HTTP ${response.status}`);
    }
    return response.text();
  }
}

class MockPublicApiSpecService implements PublicApiSpecService {
  async getSpecYaml(): Promise<string> {
    return MOCK_PUBLIC_API_SPEC;
  }
}

export const publicApiSpecService: PublicApiSpecService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LivePublicApiSpecService() : new MockPublicApiSpecService();
