import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logError, logInfo, logWarn } from "../logger";

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logInfo", () => {
  it("writes a structured JSON line to console.log", () => {
    logInfo("something happened", { foo: "bar" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", message: "something happened", foo: "bar" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("defaults context to an empty object", () => {
    logInfo("no context given");
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", message: "no context given" });
  });
});

describe("logWarn", () => {
  it("writes a structured JSON line to console.warn", () => {
    logWarn("careful", { retry: 1 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "warn", message: "careful", retry: 1 });
  });
});

describe("logError", () => {
  it("writes a structured JSON line to console.error", () => {
    logError("it broke", { code: "E_BOOM" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "error", message: "it broke", code: "E_BOOM" });
  });
});
