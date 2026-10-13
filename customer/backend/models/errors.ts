/**
 * The customer's typed error hierarchy — thrown by service/dao, mapped to
 * an HTTP status by controllers. Same shapes as `backend/models/errors.ts`,
 * copied rather than imported (CLAUDE.md §5.4); only the types a real code
 * path here needs.
 */

/** Something failed zod validation. Controllers map this to a `400`. */
export class ValidationError extends Error {
  /**
   * @param message - Human-readable summary of what failed validation.
   * @param details - The underlying cause, typically a zod `error.issues` array.
   */
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A real failure not worth retrying as-is, e.g. a failed conditional write. */
export class TerminalError extends Error {
  /**
   * @param message - Human-readable summary of what failed.
   * @param cause - The underlying error, passed through to `Error.prototype.cause`.
   */
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "TerminalError";
  }
}

/** The caller did not present a valid credential, e.g. a delivery whose signature does not verify. Maps to a `401`. */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}
