import type { FastifyReply, FastifyRequest } from "fastify";
import { worktreeListSchema } from "../../shared/models/worktree.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { listWorktrees } from "../service/worktreeService.ts";
import { respond } from "./respond.ts";

/** `GET /api/worktrees` */
export function getWorktrees(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) => respond(request, reply, worktreeListSchema, () => listWorktrees(deps));
}
