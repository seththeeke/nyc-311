import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/app.ts";
import { fixtureConfig, stubRunner } from "./fixtures.ts";

let app: FastifyInstance;
const deps = { config: fixtureConfig(), run: stubRunner({}), pidCheck: () => false, launcher: () => 777 };

beforeAll(async () => {
  app = await buildApp(deps);
});
afterAll(() => app.close());

const get = (url: string) => app.inject({ method: "GET", url });

describe("api routes", () => {
  it("GET /api/health", async () => {
    const response = await get("/api/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true });
  });

  it("GET /api/agents and /api/agents/:agent", async () => {
    expect((await get("/api/agents")).json()).toHaveLength(4);
    expect((await get("/api/agents/beta-agent")).json().config.name).toBe("beta-agent");
    expect((await get("/api/agents/nobody")).statusCode).toBe(404);
    expect((await get("/api/agents/Not_Valid")).statusCode).toBe(400);
  });

  it("GET /api/agents/:agent/runs with a limit", async () => {
    expect((await get("/api/agents/beta-agent/runs?limit=2")).json()).toHaveLength(2);
    expect((await get("/api/agents/beta-agent/runs")).json()).toHaveLength(5);
    expect((await get("/api/agents/beta-agent/runs?limit=0")).statusCode).toBe(400);
  });

  it("GET a run and its log", async () => {
    expect((await get("/api/agents/alpha-agent/runs/20261107T050004")).json().report).toContain("Held.");
    expect((await get("/api/agents/alpha-agent/runs/20991107T050004")).statusCode).toBe(404);
    expect((await get("/api/agents/alpha-agent/runs/nope")).statusCode).toBe(400);
    const log = (await get("/api/agents/gamma-agent/runs/20261107T070001/log?offset=5")).json();
    expect(log.offset).toBe(5);
    expect((await get("/api/agents/gamma-agent/runs/20261107T070001/log?offset=-1")).statusCode).toBe(400);
  });

  it("POST /api/agents/:agent/run needs the write header, a valid body, and an agent", async () => {
    const post = (url: string, body: unknown, headers: Record<string, string> = { "x-agent-orchestrator": "1" }) =>
      app.inject({ method: "POST", url, payload: body as object, headers });
    expect((await post("/api/agents/beta-agent/run", {}, {})).statusCode).toBe(403);
    const ok = await post("/api/agents/beta-agent/run", { prompt: "hi" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ agent: "beta-agent", pid: 777 });
    expect((await app.inject({ method: "POST", url: "/api/agents/beta-agent/run", headers: { "x-agent-orchestrator": "1" } })).statusCode).toBe(200);
    expect((await post("/api/agents/beta-agent/run", { promptMode: "SIDEWAYS" })).statusCode).toBe(400);
    expect((await post("/api/agents/nobody/run", {})).statusCode).toBe(404);
  });

  it("answers 409 for an agent that's already running", async () => {
    const busy = await buildApp({ ...deps, pidCheck: () => true });
    const response = await busy.inject({ method: "POST", url: "/api/agents/alpha-agent/run", payload: {}, headers: { "x-agent-orchestrator": "1" } });
    expect(response.statusCode).toBe(409);
    await busy.close();
  });

  it("GET /api/worktrees", async () => {
    expect((await get("/api/worktrees")).json()).toEqual([]);
  });

  it("has no UI routes without a built UI", async () => {
    expect((await get("/agents/x")).statusCode).toBe(404);
  });
});

describe("serving the built UI", () => {
  let dir: string;
  let ui: FastifyInstance;
  beforeAll(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "agent-web-app-"));
    writeFileSync(path.join(dir, "index.html"), "<html>ui</html>");
    ui = await buildApp({ ...deps, config: fixtureConfig({ staticDir: dir }) });
  });
  afterAll(async () => {
    await ui.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves index.html for client routes and 404s unknown /api paths", async () => {
    expect((await ui.inject({ method: "GET", url: "/" })).body).toContain("ui");
    expect((await ui.inject({ method: "GET", url: "/agents/alpha-agent" })).body).toContain("ui");
    const missing = await ui.inject({ method: "GET", url: "/api/nope" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "Not found" });
  });
});
