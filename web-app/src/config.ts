export type DataMode = "mock" | "live";

export interface AppConfig {
  apiBaseUrl: string;
  pipelineApiBaseUrl: string;
  dataMode: DataMode;
}

// `config` is a mutable singleton, not a frozen value: `import.meta.env` is
// fixed at Vite build time, but the CI pipeline builds web-app/dist once
// and deploys the identical bundle to both Nyc311-Test and Nyc311-Prod
// (cdk/web/WebsiteHosting.ts) — a build-time env var can't hold two
// different API URLs for one build. `loadRuntimeConfig` below overwrites
// `apiBaseUrl` in place from a small deploy-time-injected file instead, so
// one shared build artifact still serves the right backend per
// environment. Services read `config.apiBaseUrl` lazily (at call time, not
// import time) for exactly this reason.
export const config: AppConfig = {
  // `||`, not `??` — an empty-string apiBaseUrl means the same thing as an
  // unset one, and treating them identically is what lets a test stub it
  // to "" without needing to force a genuinely `undefined` env var.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  // Deliberately NOT part of loadRuntimeConfig/env-config.json below —
  // 2-pipeline-monitoring.md §9: unlike apiBaseUrl, this is the exact same
  // URL in every deployed environment (Nyc311Pipeline is a singleton, not
  // per-environment), so it doesn't have the "one build, two values"
  // problem that mechanism exists to solve. Just a plain checked-in
  // build-time value (web-app/.env, not .env.local).
  pipelineApiBaseUrl: import.meta.env.VITE_PIPELINE_API_BASE_URL || "",
  dataMode: import.meta.env.VITE_DATA_MODE === "live" ? "live" : "mock",
};

interface RuntimeEnvConfig {
  apiBaseUrl?: string;
}

const RUNTIME_CONFIG_PATH = "/env-config.json";

/**
 * Fetches `/env-config.json` — written alongside the built SPA by
 * `cdk/web/WebsiteDeployment.ts` for a real deployed environment, using
 * that environment's own `Nyc311Api.apiEndpoint` (only known at CDK deploy
 * time, since API Gateway's domain is AWS-generated, not something we can
 * hardcode ahead of a deploy) — and merges its `apiBaseUrl` into `config`.
 *
 * Safe to call with no such file present (local dev via `npm run dev`,
 * where `.env.local`'s `VITE_API_BASE_URL` is the only source of truth):
 * a 404 or network failure is swallowed and `config` keeps its
 * Vite-build-time default. Call once, before the app renders (`main.tsx`),
 * so every service/hook sees the final value on their first read.
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
    // No env-config.json reachable (local dev, or a transient network
    // blip) — keep the Vite-build-time default rather than failing app
    // startup over an optional enhancement.
  }
}
