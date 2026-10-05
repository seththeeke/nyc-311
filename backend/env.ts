/**
 * Shared environment-variable access, same top-level pattern as
 * `logger.ts` — this isn't a type/DAO, just a cross-layer helper every
 * `service/` file needing a Lambda env var reaches for. Factors out a
 * one-liner that 21 `service/` files each defined identically.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
