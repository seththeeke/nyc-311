import { existsSync } from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { getAgentByName } from "./controller/getAgentByName.ts";
import { getAgents } from "./controller/getAgents.ts";
import { getHealth } from "./controller/getHealth.ts";
import { getRunById } from "./controller/getRunById.ts";
import { getRunLog } from "./controller/getRunLog.ts";
import { getRuns } from "./controller/getRuns.ts";
import { getWorktrees } from "./controller/getWorktrees.ts";
import { postRun } from "./controller/postRun.ts";
import type { LaunchDeps } from "./service/runLaunchService.ts";

/** The Fastify app: the `/api` read routes (SPEC.md §3.4), the one write route (§5.1), and the built UI when `config.staticDir` exists. */
export async function buildApp(deps: LaunchDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.get("/api/health", getHealth(deps));
  app.get("/api/agents", getAgents(deps));
  app.get("/api/agents/:agent", getAgentByName(deps));
  app.get("/api/agents/:agent/runs", getRuns(deps));
  app.get("/api/agents/:agent/runs/:runId", getRunById(deps));
  app.get("/api/agents/:agent/runs/:runId/log", getRunLog(deps));
  app.get("/api/worktrees", getWorktrees(deps));
  app.post("/api/agents/:agent/run", postRun(deps));

  const staticDir = deps.config.staticDir;
  if (staticDir && existsSync(path.join(staticDir, "index.html"))) {
    await app.register(fastifyStatic, { root: staticDir });
    /* Client-side routes (/agents/x, /runs/...) fall back to the SPA; unknown /api paths stay 404. */
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith("/api/") ? reply.code(404).send({ error: "Not found" }) : reply.sendFile("index.html"),
    );
  }
  return app;
}
