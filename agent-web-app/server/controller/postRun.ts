import type { FastifyReply, FastifyRequest } from "fastify";
import { runRequestSchema, runStartedSchema } from "../../shared/models/runRequest.ts";
import { ForbiddenError } from "../models/errors.ts";
import { startRun, type LaunchDeps } from "../service/runLaunchService.ts";
import { agentParamsSchema } from "./params.ts";
import { parseInput, respond } from "./respond.ts";

/** The header every write must carry: a cross-site page can't send it without a CORS preflight, which this server never approves. */
export const WRITE_HEADER = "x-agent-orchestrator";

/** `POST /api/agents/:agent/run` */
export function postRun(deps: LaunchDeps) {
  return (request: FastifyRequest, reply: FastifyReply) =>
    respond(request, reply, runStartedSchema, async () => {
      if (request.headers[WRITE_HEADER] !== "1") throw new ForbiddenError(`Writes need the ${WRITE_HEADER}: 1 header`);
      const { agent } = parseInput(agentParamsSchema, request.params);
      return startRun(deps, agent, parseInput(runRequestSchema, request.body ?? {}));
    });
}
