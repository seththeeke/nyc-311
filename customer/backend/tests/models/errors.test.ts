import { describe, expect, it } from "vitest";
import { TerminalError, UnauthorizedError, ValidationError } from "../../models/errors";

describe("customer error types", () => {
  it("ValidationError carries a name, message and optional details", () => {
    const err = new ValidationError("bad input", { field: "x" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ValidationError");
    expect(err.details).toEqual({ field: "x" });
    expect(new ValidationError("bad input").details).toBeUndefined();
  });

  it("TerminalError carries a name, message and cause", () => {
    const cause = new Error("underlying");
    const err = new TerminalError("failed", cause);
    expect(err.name).toBe("TerminalError");
    expect(err.cause).toBe(cause);
  });

  it("UnauthorizedError carries a name and message", () => {
    const err = new UnauthorizedError("bad signature");
    expect(err.name).toBe("UnauthorizedError");
    expect(err.message).toBe("bad signature");
  });
});
