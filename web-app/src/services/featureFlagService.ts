import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";
import {
  FeatureFlagListSchema,
  FeatureFlagSchema,
  type CreateFeatureFlagRequest,
  type FeatureFlag,
  type UpdateFeatureFlagRequest,
} from "../models/featureFlag";
import { MOCK_FEATURE_FLAGS } from "../test-data/featureFlags";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1). Reads are public (11-street-condition-implementation.md
 * §4.2); every write goes through the admin JWT.
 */
export interface FeatureFlagService {
  listFeatureFlags(): Promise<FeatureFlag[]>;
  createFeatureFlag(request: CreateFeatureFlagRequest): Promise<FeatureFlag>;
  updateFeatureFlag(flagKey: string, request: UpdateFeatureFlagRequest): Promise<FeatureFlag>;
  deleteFeatureFlag(flagKey: string): Promise<void>;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error("Not authenticated");
  }
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
}

/** Surfaces the API's own `message` (e.g. a 409's "reload and retry") when it sent one. */
async function failure(action: string, response: Response): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
      return new Error(`Failed to ${action}: ${body.message}`);
    }
  } catch {
    /* No JSON body — fall back to the status code alone. */
  }
  return new Error(`Failed to ${action}: HTTP ${response.status}`);
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

class LiveFeatureFlagService implements FeatureFlagService {
  async listFeatureFlags(): Promise<FeatureFlag[]> {
    const response = await fetch(`${config.apiBaseUrl}/feature-flags`);
    if (!response.ok) throw await failure("list feature flags", response);
    return FeatureFlagListSchema.parse(await response.json()).flags;
  }

  async createFeatureFlag(request: CreateFeatureFlagRequest): Promise<FeatureFlag> {
    const response = await authorizedFetch("/admin/feature-flags", jsonInit("POST", request));
    if (!response.ok) throw await failure("create feature flag", response);
    return FeatureFlagSchema.parse(await response.json());
  }

  async updateFeatureFlag(flagKey: string, request: UpdateFeatureFlagRequest): Promise<FeatureFlag> {
    const response = await authorizedFetch(`/admin/feature-flags/${encodeURIComponent(flagKey)}`, jsonInit("PUT", request));
    if (!response.ok) throw await failure("update feature flag", response);
    return FeatureFlagSchema.parse(await response.json());
  }

  async deleteFeatureFlag(flagKey: string): Promise<void> {
    const response = await authorizedFetch(`/admin/feature-flags/${encodeURIComponent(flagKey)}`, { method: "DELETE" });
    if (!response.ok) throw await failure("delete feature flag", response);
  }
}

const MOCK_ADMIN_USER_ID = "01MOCKADMIN";

/* Module-scope mutable state, same lifecycle as capacityService's mock roster. */
let mockFlags: FeatureFlag[] = MOCK_FEATURE_FLAGS.map((flag) => ({ ...flag }));

class MockFeatureFlagService implements FeatureFlagService {
  async listFeatureFlags(): Promise<FeatureFlag[]> {
    return [...mockFlags].sort((a, b) => a.flag_key.localeCompare(b.flag_key));
  }

  async createFeatureFlag(request: CreateFeatureFlagRequest): Promise<FeatureFlag> {
    if (mockFlags.some((flag) => flag.flag_key === request.flag_key)) {
      throw new Error(`Failed to create feature flag: Feature flag ${request.flag_key} already exists`);
    }
    const now = new Date().toISOString();
    const created: FeatureFlag = { ...request, version: 1, created_at: now, updated_at: now, updated_by: MOCK_ADMIN_USER_ID };
    mockFlags = [...mockFlags, created];
    return created;
  }

  async updateFeatureFlag(flagKey: string, request: UpdateFeatureFlagRequest): Promise<FeatureFlag> {
    const existing = mockFlags.find((flag) => flag.flag_key === flagKey);
    if (!existing) throw new Error(`Failed to update feature flag: No feature flag ${flagKey}`);
    const { expected_version: expectedVersion, ...input } = request;
    if (existing.version !== expectedVersion) {
      throw new Error(`Failed to update feature flag: Feature flag ${flagKey} changed since version ${expectedVersion} — reload and retry`);
    }
    const updated: FeatureFlag = {
      ...input,
      flag_key: flagKey,
      version: expectedVersion + 1,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
      updated_by: MOCK_ADMIN_USER_ID,
    };
    mockFlags = mockFlags.map((flag) => (flag.flag_key === flagKey ? updated : flag));
    return updated;
  }

  async deleteFeatureFlag(flagKey: string): Promise<void> {
    if (!mockFlags.some((flag) => flag.flag_key === flagKey)) {
      throw new Error(`Failed to delete feature flag: No feature flag ${flagKey}`);
    }
    mockFlags = mockFlags.filter((flag) => flag.flag_key !== flagKey);
  }
}

export const featureFlagService: FeatureFlagService =
  config.dataMode === "live" ? new LiveFeatureFlagService() : new MockFeatureFlagService();
