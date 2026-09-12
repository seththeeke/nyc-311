import { describe, expect, it } from "vitest";
import { NotFoundError, TerminalError, ValidationError } from "../../models/errors";

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
