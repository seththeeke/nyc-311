import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { FeatureFlagDao } from "./featureFlagDao";

/**
 * Builds a fresh `FeatureFlagDao` on every call, reading
 * `FEATURE_FLAGS_TABLE_NAME` only then: the one place that names this
 * table's env var (§5.2: lazy, never module scope).
 */
export function getFeatureFlagDao(): FeatureFlagDao {
  return new FeatureFlagDao(createDocumentClient(), requireEnv("FEATURE_FLAGS_TABLE_NAME"));
}
