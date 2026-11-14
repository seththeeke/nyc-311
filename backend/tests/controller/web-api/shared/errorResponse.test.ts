import { describe, expect, it } from "vitest";
import { errorResponse } from "../../../../controller/web-api/shared/errorResponse";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  TerminalError,
  UnauthorizedError,
  ValidationError,
} from "../../../../models/errors";

function bodyOf(result: ReturnType<typeof errorResponse>): unknown {
  return JSON.parse(result.body as string);
}

describe("errorResponse", () => {
  it.each([
    [new ValidationError("bad"), 400],
    [new UnauthorizedError("who"), 401],
    [new ForbiddenError("no"), 403],
    [new NotFoundError("gone"), 404],
    [new ConflictError("clash"), 409],
    [new RateLimitedError("slow down"), 429],
  ])("maps %o to its documented status with its own message", (err, status) => {
    const result = errorResponse(err, "Fallback");
    expect(result.statusCode).toBe(status);
    expect(result.headers).toEqual({ "Content-Type": "application/json" });
    expect(bodyOf(result)).toEqual({ message: err.message });
  });

  it("answers a TerminalError 500 with the fallback message, hiding its text", () => {
    const result = errorResponse(new TerminalError("Missing sub/email claims"), "Failed to do the thing");
    expect(result.statusCode).toBe(500);
    expect(bodyOf(result)).toEqual({ message: "Failed to do the thing" });
  });

  it("answers an untyped error or a thrown non-Error 500 with the fallback message", () => {
    expect(errorResponse(new Error("boom"), "Fallback")).toMatchObject({ statusCode: 500, body: JSON.stringify({ message: "Fallback" }) });
    expect(errorResponse("string failure", "Fallback")).toMatchObject({ statusCode: 500, body: JSON.stringify({ message: "Fallback" }) });
  });

  it("applies a route override before the shared table, with the error's own message by default", () => {
    const result = errorResponse(new TerminalError("already exists"), "Fallback", [{ type: TerminalError, status: 409 }]);
    expect(result.statusCode).toBe(409);
    expect(bodyOf(result)).toEqual({ message: "already exists" });
  });

  it("uses an override's own message when it gives one", () => {
    const result = errorResponse(new NotFoundError("raw"), "Fallback", [{ type: NotFoundError, status: 404, message: "Nicer" }]);
    expect(result.statusCode).toBe(404);
    expect(bodyOf(result)).toEqual({ message: "Nicer" });
  });

  it("falls through to the shared table when no override matches", () => {
    const result = errorResponse(new ValidationError("bad"), "Fallback", [{ type: TerminalError, status: 409 }]);
    expect(result.statusCode).toBe(400);
  });
});
