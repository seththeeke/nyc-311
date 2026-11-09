/*
 * #200 — every pipeline install runs this, never a bare `npm ci`. npm's
 * built-in audit is CPU-bound advisory math that took ~30s on CodeBuild's
 * cold cache (Synth, ProdDiff, IntegrationTests), and no step reads it.
 * Same lockfile, same packages; advisories are tracked by `npm audit` runs
 * outside the pipeline. scripts/agent-*.sh already pass the same flags.
 */
export const NPM_CI = "npm ci --no-audit --no-fund";
