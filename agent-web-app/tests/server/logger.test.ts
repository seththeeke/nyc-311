import { describe, expect, it, vi } from "vitest";
import { logError, logInfo, logWarn } from "../../server/logger.ts";

describe("logger", () => {
  it("writes one JSON line per level", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logInfo("i", { a: 1 });
    logWarn("w");
    logError("e");
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ level: "info", message: "i", a: 1 });
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({ level: "warn" });
    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({ level: "error" });
    vi.restoreAllMocks();
  });
});
