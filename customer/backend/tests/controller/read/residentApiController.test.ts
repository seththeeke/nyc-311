import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../service/read/residentReadService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../service/read/residentReadService")>();
  return { ...actual, listResidents: vi.fn(), getResident: vi.fn(), listIdeas: vi.fn(), getIdea: vi.fn() };
});

import { residentApiController } from "../../../controller/read/residentApiController";
import { NotFoundError, ValidationError } from "../../../models/errors";
import { getIdea, getResident, listIdeas, listResidents } from "../../../service/read/residentReadService";

function event(routeKey: string, pathParameters: Record<string, string> = {}, query: Record<string, string> | null = null) {
  return { rawPath: "/x", routeKey, requestContext: { http: { method: "GET" } }, pathParameters, queryStringParameters: query };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.clearAllMocks());

describe("residentApiController", () => {
  it("routes each read to its service with limit and cursor", async () => {
    vi.mocked(listResidents).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(getResident).mockResolvedValue({ persona_id: "hawthorn" } as never);
    vi.mocked(listIdeas).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(getIdea).mockResolvedValue({ idea_id: "01X" } as never);

    const listed = await residentApiController(event("GET /residents", {}, { limit: "5", cursor: "c" }));
    expect(listed).toMatchObject({ statusCode: 200, headers: { "Cache-Control": "public, max-age=30" } });
    expect(listResidents).toHaveBeenCalledWith(5, "c");

    await residentApiController(event("GET /residents/{personaId}", { personaId: "hawthorn" }));
    expect(getResident).toHaveBeenCalledWith("hawthorn");
    await residentApiController(event("GET /residents/{personaId}/ideas", { personaId: "hawthorn" }));
    expect(listIdeas).toHaveBeenCalledWith({ personaId: "hawthorn", limit: 20, cursor: undefined });
    const one = await residentApiController(event("GET /residents/{personaId}/ideas/{ideaId}", { personaId: "hawthorn", ideaId: "01X" }));
    expect(JSON.parse(one.body ?? "")).toEqual({ idea_id: "01X" });
    await residentApiController(event("GET /ideas"));
    expect(listIdeas).toHaveBeenLastCalledWith({ limit: 20, cursor: undefined });
  });

  it("maps bad input to 400, unknown things to 404 and anything else to 500", async () => {
    expect((await residentApiController({ nope: true })).statusCode).toBe(400);
    expect((await residentApiController(event("GET /residents", {}, { limit: "500" }))).statusCode).toBe(400);
    expect((await residentApiController(event("GET /residents/{personaId}"))).statusCode).toBe(400);
    expect((await residentApiController(event("GET /secrets"))).statusCode).toBe(404);
    expect((await residentApiController({ rawPath: "/x", requestContext: { http: { method: "GET" } } })).statusCode).toBe(404);
    vi.mocked(getResident).mockRejectedValueOnce(new NotFoundError("No resident x")).mockRejectedValueOnce(new ValidationError("bad")).mockRejectedValueOnce("boom");
    expect((await residentApiController(event("GET /residents/{personaId}", { personaId: "x" }))).statusCode).toBe(404);
    expect((await residentApiController(event("GET /residents/{personaId}", { personaId: "x" }))).statusCode).toBe(400);
    expect((await residentApiController(event("GET /residents/{personaId}", { personaId: "x" }))).statusCode).toBe(500);
  });
});
