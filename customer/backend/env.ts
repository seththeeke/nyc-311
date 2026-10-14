/**
 * Shared environment-variable access. Copied from `backend/env.ts`, never
 * imported (CLAUDE.md §5.4) — the customer shares no code with the bureau.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
