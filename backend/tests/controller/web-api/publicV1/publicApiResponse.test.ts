import { describe, expect, it } from "vitest";
import { z } from "zod";
import { NO_USAGE, issuesToDetails, publicError, publicResult } from "../../../../controller/web-api/publicV1/publicApiResponse";

describe("publicApiResponse", () => {
  it("builds results and errors in the public shape", () => {
    expect(publicResult(200, { a: 1 })).toEqual({ status_code: 200, body: { a: 1 }, usage: NO_USAGE });
    expect(publicError(404, "NOT_FOUND", "gone")).toEqual({ status_code: 404, body: { error: { code: "NOT_FOUND", message: "gone" } }, usage: NO_USAGE });
    expect(publicError(400, "VALIDATION_ERROR", "bad", [{ field: "title", issue: "too short" }]).body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "bad", details: [{ field: "title", issue: "too short" }] },
    });
  });

  it("names each failing field, with an optional prefix", () => {
    const issues = z.object({ a: z.object({ b: z.string() }) }).safeParse({ a: { b: 1 } }).error?.issues ?? [];
    expect(issuesToDetails(issues)).toEqual([{ field: "a.b", issue: "Expected string, received number" }]);
    expect(issuesToDetails(issues, "path")[0].field).toBe("path.a.b");
    const rootIssues = z.string().safeParse(1).error?.issues ?? [];
    expect(issuesToDetails(rootIssues)[0].field).toBe("body");
  });
});
