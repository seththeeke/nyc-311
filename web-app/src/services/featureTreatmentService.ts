import { config } from "../config";
import { FeatureTreatmentSchema } from "../models/featureTreatment";
import { MOCK_FEATURE_FLAGS } from "../test-data/featureFlags";

/*
 * Asks the API which treatment a flag resolves to, through the public
 * evaluation route (11-street-condition-implementation.md §4.2). The
 * web-app sends no context, so allocations and the default decide.
 */
export interface FeatureTreatmentService {
  /** @returns The treatment, or `null` when no such flag exists. */
  getTreatment(flagKey: string): Promise<string | null>;
}

const NOT_FOUND = 404;

class LiveFeatureTreatmentService implements FeatureTreatmentService {
  async getTreatment(flagKey: string): Promise<string | null> {
    const response = await fetch(`${config.apiBaseUrl}/feature-flags/${encodeURIComponent(flagKey)}/treatment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: {} }),
    });
    if (response.status === NOT_FOUND) return null;
    if (!response.ok) throw new Error(`Failed to evaluate feature flag ${flagKey}: HTTP ${response.status}`);
    return FeatureTreatmentSchema.parse(await response.json()).treatment;
  }
}

/* Mock mode resolves to each sample flag's default — no allocation draw. */
class MockFeatureTreatmentService implements FeatureTreatmentService {
  async getTreatment(flagKey: string): Promise<string | null> {
    return MOCK_FEATURE_FLAGS.find((flag) => flag.flag_key === flagKey)?.default_treatment ?? null;
  }
}

export const featureTreatmentService: FeatureTreatmentService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LiveFeatureTreatmentService() : new MockFeatureTreatmentService();
