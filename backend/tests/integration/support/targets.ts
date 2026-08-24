import { execFileSync } from "node:child_process";

/**
 * Resolves the integration suite's target base URL. `INTEGRATION_TARGET`
 * is required — throws rather than defaulting, so a misconfigured run
 * fails loudly instead of silently skipping (the old
 * `describe.skipIf(!API_URL)` pattern's problem). `local` points at
 * `sam local start-api`'s default port; `test`/`prod` prefer
 * `API_BASE_URL` when the pipeline has set it, else look it up directly —
 * same lookup the old `test-scripts/` Python scripts used.
 */

const AWS_PROFILE = "nyc311";
const LOCAL_BASE_URL = "http://localhost:3000";

const STACK_NAME_BY_TARGET = {
  test: "Nyc311-Test",
  prod: "Nyc311-Prod",
} as const;

export type IntegrationTarget = "local" | "test" | "prod";

function parseTarget(raw: string | undefined): IntegrationTarget {
  if (raw === "local" || raw === "test" || raw === "prod") return raw;
  throw new Error(`INTEGRATION_TARGET must be one of "local", "test", "prod" — got ${JSON.stringify(raw)}`);
}

function lookupDeployedApiUrl(stackName: string): string {
  const output = execFileSync(
    "aws",
    ["cloudformation", "describe-stacks", "--stack-name", stackName, "--profile", AWS_PROFILE, "--output", "json"],
    { encoding: "utf8" },
  );
  const stacks = JSON.parse(output).Stacks as { Outputs?: { OutputKey: string; OutputValue: string }[] }[];
  const url = stacks[0]?.Outputs?.find((o) => o.OutputKey === "Nyc311ApiUrl")?.OutputValue;
  if (!url) {
    throw new Error(`No Nyc311ApiUrl output on ${stackName} — has Nyc311Api been deployed yet?`);
  }
  return url.replace(/\/$/, "");
}

export function resolveBaseUrl(): string {
  const target = parseTarget(process.env.INTEGRATION_TARGET);

  if (target === "local") return LOCAL_BASE_URL;
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL.replace(/\/$/, "");
  return lookupDeployedApiUrl(STACK_NAME_BY_TARGET[target]);
}

let cachedBaseUrl: string | undefined;

/** Lazily resolved and memoized — importing this module never itself triggers a network/CLI call, only the first real request does. */
export function getBaseUrl(): string {
  cachedBaseUrl ??= resolveBaseUrl();
  return cachedBaseUrl;
}
