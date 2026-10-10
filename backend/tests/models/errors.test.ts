import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, TerminalError, UnauthorizedError, ValidationError } from "../../models/errors";

describe("ValidationError", () => {
  it("sets name, message, and details", () => {
    const err = new ValidationError("bad input", { field: "x" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ValidationError");
    expect(err.message).toBe("bad input");
    expect(err.details).toEqual({ field: "x" });
  });

  it("allows omitting details", () => {
    const err = new ValidationError("bad input");
    expect(err.details).toBeUndefined();
  });
});

describe("NotFoundError", () => {
  it("sets name and message", () => {
    const err = new NotFoundError("no such Operator");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("NotFoundError");
    expect(err.message).toBe("no such Operator");
  });
});

describe("TerminalError", () => {
  it("sets name, message, and cause", () => {
    const original = new Error("underlying");
    const err = new TerminalError("terminal failure", original);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TerminalError");
    expect(err.message).toBe("terminal failure");
    expect(err.cause).toBe(original);
  });

  it("allows omitting cause", () => {
    const err = new TerminalError("terminal failure");
    expect(err.cause).toBeUndefined();
  });
});

describe("ConflictError", () => {
  it("is an Error named ConflictError, carrying its message", () => {
    const err = new ConflictError("Operator 01OPERATOR is no longer available to claim");

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ConflictError");
    expect(err.message).toBe("Operator 01OPERATOR is no longer available to claim");
  });
});

describe("UnauthorizedError", () => {
  it("sets name and message", () => {
    const err = new UnauthorizedError("bad key");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("UnauthorizedError");
    expect(err.message).toBe("bad key");
  });
});
