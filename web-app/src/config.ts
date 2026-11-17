import { RuntimeEnvConfigSchema } from "./models/runtimeEnvConfig";

export interface AppConfig {
  apiBaseUrl: string;
  pipelineApiBaseUrl: string;
  /** Cognito User Pool / app client ids (`9-admin-auth-integration.md` §3) — same runtime-injected shape as `apiBaseUrl`. */
  userPoolId: string;
  userPoolClientId: string;
  /** The residents' own API (`13-customer-simulation.md` §4) — one host for every environment, since the simulation runs only in Prod. */
  residentApiBaseUrl: string;
  /** The public API (`16-resident-action-models.md` §2) — per environment, so runtime-injected like `apiBaseUrl`. */
  publicApiBaseUrl: string;
  /** The Team Chat API (docs/17-executive-team.md §10), per environment, so runtime-injected like `apiBaseUrl`. */
  chatApiBaseUrl: string;
}

/*
 * `config` is a mutable singleton, not frozen: the pipeline builds
 * web-app/dist once and deploys the identical bundle to both environments,
 * so a build-time env var can't hold two API URLs. `loadRuntimeConfig`
 * overwrites the per-environment fields from a deploy-time-injected file
 * instead; read them lazily, not at import time.
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
  userPoolId: import.meta.env.VITE_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || "",
  residentApiBaseUrl: import.meta.env.VITE_RESIDENT_API_BASE_URL || "https://customer-api.boroughsim.com",
  /*
   * Test's hosts are a dev-server convenience only: a production build
   * folds `DEV` to false and defaults to "", so a Prod page whose
   * env-config.json failed to load breaks loudly instead of reading Test data.
   */
  publicApiBaseUrl:
    import.meta.env.VITE_PUBLIC_API_BASE_URL || (import.meta.env.DEV ? "https://public-api.test.boroughsim.com" : ""),
  chatApiBaseUrl:
    import.meta.env.VITE_CHAT_API_BASE_URL || (import.meta.env.DEV ? "https://chat-api.test.boroughsim.com" : ""),
};

const RUNTIME_CONFIG_PATH = "/env-config.json";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

/*
 * A deployed site always has env-config.json, so a failed load there is a
 * real fault worth a console line; on localhost it is the normal case.
 * Logs only the reason, never the file's contents.
 */
function warnRuntimeConfigFailure(reason: string): void {
  if (LOCAL_HOSTNAMES.has(globalThis.location.hostname)) return;
  console.warn(`config: ${RUNTIME_CONFIG_PATH} not applied (${reason}); using build-time defaults`);
}

/**
 * Fetches `/env-config.json`, written by `WebsiteDeployment.ts` per
 * environment, parses it with `RuntimeEnvConfigSchema` and merges every
 * field it sets (API hosts, Cognito ids) into `config`. A missing or
 * malformed file keeps the build-time defaults and is logged off localhost.
 * Call once before render.
 */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const response = await fetch(RUNTIME_CONFIG_PATH);
    if (!response.ok) {
      warnRuntimeConfigFailure(`HTTP ${response.status}`);
      return;
    }
    const parsed = RuntimeEnvConfigSchema.safeParse(await response.json());
    if (!parsed.success) {
      warnRuntimeConfigFailure("malformed body");
      return;
    }
    for (const key of RuntimeEnvConfigSchema.keyof().options) {
      const value = parsed.data[key];
      if (value !== undefined) config[key] = value;
    }
  } catch (error) {
    warnRuntimeConfigFailure(error instanceof Error ? error.message : "unknown error");
  }
}
