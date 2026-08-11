/**
 * Shared typed error hierarchy, per `CLAUDE.md` §5.2 — thrown by
 * `service`/`dao`, caught by `controller`. Two things read these types:
 *
 * - API Gateway-backed controllers map `.name` to an HTTP status code.
 * - Step-Functions-invoked controllers let the error propagate; `cdk/`'s
 *   `Catch`/`Retry` blocks route on `Error.Name` (e.g. retry a
 *   `TransientError`, go straight to Case-creation on a `TerminalError`,
 *   per `claude-prompt-initial.md` §4.1).
 *
 * Both consumers need `.name` to be a stable, small, well-known set — so
 * **only define an error type here once an actual code path needs to throw
 * it**, not speculatively. Before adding a new one, check whether an
 * existing type already fits:
 *
 * - Input/stored data doesn't match its schema, at any boundary (an API
 *   request body, a DynamoDB item, a third-party API response)? →
 *   {@link ValidationError}.
 * - The failure is real but retrying the exact same call would fail again
 *   identically (a conditional-write collision, a business-rule
 *   violation)? → {@link TerminalError}.
 * - Genuinely neither fits — e.g. "the thing wasn't found" or "this looks
 *   transient, retry it" aren't errors either existing type honestly
 *   describes — that's when a new class (`NotFoundError`, `TransientError`,
 *   ...) earns its place. Give it the same shape as these two: extend
 *   `Error`, set `this.name` to the class name in the constructor, document
 *   here when to use it vs. its siblings.
 */

/**
 * Something failed zod validation: a caller passed a malformed entity to
 * `Dao.putItem`, or a value read back from storage (or a third-party API)
 * doesn't match its expected schema.
 *
 * Not retryable by resending the same input — the caller (or the upstream
 * data source) needs to fix the shape first. API Gateway controllers should
 * map this to a `400`.
 */
export class ValidationError extends Error {
  /**
   * @param message - Human-readable summary of what failed validation.
   * @param details - The underlying cause, typically a zod
   * `error.issues` array — kept as `unknown` here so this class has no
   * dependency on zod itself.
   */
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * A failure that is real and not worth retrying as-is — retrying the exact
 * same call would fail again for the same reason (e.g. a
 * `ConditionalCheckFailedException` from a duplicate-guarded write).
 *
 * Named to match `cdk/`'s Step Functions `Catch` vocabulary
 * (`claude-prompt-initial.md` §4.1): a state machine catching a
 * `TerminalError` should go straight to Case-creation rather than retry.
 * API Gateway controllers should map this to a `409`/`500` depending on
 * context, not a `400` (the request wasn't malformed — the operation
 * genuinely can't succeed as attempted).
 */
export class TerminalError extends Error {
  /**
   * @param message - Human-readable summary of what failed.
   * @param cause - The underlying error, if any. Passed through to the
   * native `Error` `cause` chain (`Error.prototype.cause`) rather than a
   * custom field, so standard error-logging tooling picks it up.
   */
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "TerminalError";
  }
}
