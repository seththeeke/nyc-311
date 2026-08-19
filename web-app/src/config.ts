export type DataMode = "mock" | "live";

export interface AppConfig {
  apiBaseUrl: string;
  pipelineApiBaseUrl: string;
  dataMode: DataMode;
}

/*
 * `config` is a mutable singleton, not frozen: the pipeline builds
 * web-app/dist once and deploys the identical bundle to both environments,
 * so a build-time env var can't hold two API URLs. `loadRuntimeConfig`
 * overwrites `apiBaseUrl` from a deploy-time-injected file instead; read
 * `config.apiBaseUrl` lazily, not at import time.
 */
export const config: AppConfig = {
  /*
   * `||`, not `??` — an empty-string apiBaseUrl means the same thing as an
   * unset one, and treating them identically is what lets a test stub it
   * to "" without needing to force a genuinely `undefined` env var.
   */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  /*
   * Deliberately NOT part of loadRuntimeConfig/env-config.json below —
   * 2-pipeline-monitoring.md §9: unlike apiBaseUrl, this is the exact same
   * URL in every deployed environment (Nyc311Pipeline is a singleton, not
   * per-environment), so it doesn't have the "one build, two values"
   * problem that mechanism exists to solve. Just a plain checked-in
   * build-time value (web-app/.env, not .env.local).
   */
  pipelineApiBaseUrl: import.meta.env.VITE_PIPELINE_API_BASE_URL || "",
  dataMode: import.meta.env.VITE_DATA_MODE === "live" ? "live" : "mock",
};

interface RuntimeEnvConfig {
  apiBaseUrl?: string;
}

const RUNTIME_CONFIG_PATH = "/env-config.json";

/**
 * Fetches `/env-config.json` — written by `WebsiteDeployment.ts` with the
 * deployed environment's real API URL — and merges `apiBaseUrl` into
 * `config`. Safe with no such file (local dev): failures are swallowed and
 * `config` keeps its Vite-build-time default. Call once before render.
 */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const response = await fetch(RUNTIME_CONFIG_PATH);
    if (!response.ok) return;
    const runtime = (await response.json()) as RuntimeEnvConfig;
    if (typeof runtime.apiBaseUrl === "string" && runtime.apiBaseUrl.length > 0) {
      config.apiBaseUrl = runtime.apiBaseUrl;
    }
  } catch {
    /*
     * No env-config.json reachable (local dev, or a transient network
     * blip) — keep the Vite-build-time default rather than failing app
     * startup over an optional enhancement.
     */
  }
}
