import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, getJson } from "../../../web/services/apiClient.ts";

describe("getJson", () => {
  it("parses a 2xx body through the schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ a: 1 }))));
    expect(await getJson("/x", z.object({ a: z.number() }))).toEqual({ a: 1 });
    expect(fetch).toHaveBeenCalledWith("/api/x");
  });

  it("throws ApiError with the server's message, or the status when there's none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 404 })));
    await expect(getJson("/x", z.unknown())).rejects.toMatchObject({ name: "ApiError", status: 404, message: "nope" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 502 })));
    await expect(getJson("/x", z.unknown())).rejects.toBeInstanceOf(ApiError);
    await expect(getJson("/x", z.unknown())).rejects.toThrow("HTTP 502");
  });

  it("fails loudly on a drifted body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ a: "x" }))));
    await expect(getJson("/x", z.object({ a: z.number() }))).rejects.toThrow();
  });
});
