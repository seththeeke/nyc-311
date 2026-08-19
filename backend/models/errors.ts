/**
 * Shared typed error hierarchy (`CLAUDE.md` §5.2) — thrown by
 * `service`/`dao`, caught by `controller`. API Gateway controllers map
 * `.name` to an HTTP status; Step-Functions controllers let it propagate for
 * `cdk/`'s `Catch`/`Retry` blocks to route on. Only add a new type once a
 * real code path needs it — check {@link ValidationError}/
 * {@link TerminalError} fit first.
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
 * A real failure not worth retrying as-is (e.g. a
 * `ConditionalCheckFailedException`). A Step Functions `Catch` on this
 * should go straight to Case-creation, not retry; API Gateway controllers
 * should map it to `409`/`500`, not `400`.
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
