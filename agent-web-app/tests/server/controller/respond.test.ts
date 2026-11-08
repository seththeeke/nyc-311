import { describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseInput, respond } from "../../../server/controller/respond.ts";
import { ValidationError } from "../../../server/models/errors.ts";

function fakeReply() {
  const reply = { status: 0, body: undefined as unknown, code(status: number) { reply.status = status; return reply; }, send(body: unknown) { reply.body = body; return reply; } };
  return reply;
}
const request = { method: "GET", url: "/api/x" } as FastifyRequest;

describe("respond", () => {
  it("sends a 500 when the handler throws or its result doesn't match the schema", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const thrown = fakeReply();
    await respond(request, thrown as unknown as FastifyReply, z.string(), async () => { throw new Error("boom"); });
    expect(thrown).toMatchObject({ status: 500, body: { error: "boom" } });
    const drifted = fakeReply();
    await respond(request, drifted as unknown as FastifyReply, z.string(), async () => 42 as unknown as string);
    expect(drifted.status).toBe(500);
    const odd = fakeReply();
    await respond(request, odd as unknown as FastifyReply, z.string(), async () => { throw "plain"; });
    expect(odd.body).toEqual({ error: "plain" });
    vi.restoreAllMocks();
  });
});

describe("parseInput", () => {
  it("returns parsed input or throws a ValidationError naming the field", () => {
    expect(parseInput(z.object({ n: z.coerce.number() }), { n: "3" })).toEqual({ n: 3 });
    expect(() => parseInput(z.object({ n: z.number() }), {})).toThrow(ValidationError);
    expect(() => parseInput(z.object({ n: z.number() }), {})).toThrow(/^n: /);
  });
});
