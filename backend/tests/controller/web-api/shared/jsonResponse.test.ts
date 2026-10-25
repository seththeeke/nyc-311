import { describe, expect, it } from "vitest";
import { jsonResponse } from "../../../../controller/web-api/shared/jsonResponse";

describe("jsonResponse", () => {
  it("serializes the body and sets the JSON content-type header", () => {
    expect(jsonResponse(200, { ok: true })).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });

  it("carries through whatever status code it's given", () => {
    expect(jsonResponse(404, { message: "not found" })).toMatchObject({ statusCode: 404 });
  });
});
