import { z } from "zod";
import type { BoroughSimOpsClient } from "../../service/opsClient/boroughSimOpsClient";
import { defineTool, type McpTool } from "./mcpTool";

export type BoroughSimOpsTool = McpTool<BoroughSimOpsClient>;

const tool = defineTool<BoroughSimOpsClient>();
const reason = z.string().trim().min(1).max(500).describe("Why, from the data: it's recorded on the operator's history.");

/* The COO's capacity tools (docs/17-executive-team.md §12.4). */
export const BOROUGH_SIM_OPS_TOOLS: readonly BoroughSimOpsTool[] = [
  tool({
    name: "get_capacity_snapshot",
    description:
      "Read the data behind a capacity decision: the fleet (size, idle, busy, each operator), the median time to resolve over 7 days and per day for 14, orders accepted and resolved per day, the backlog waiting to be scheduled and its oldest order, the burn rate, and today's recruit and release limits. Facts only; the decision is yours.",
    inputSchema: {},
    run: (client) => client.getCapacitySnapshot(),
  }),
  tool({
    name: "recruit_operator",
    description: "Hire one new operator into the fleet. At most 2 recruits a New York day; a 409 means today's limit is reached.",
    inputSchema: { name: z.string().trim().min(1).max(80).describe("A name for the operator, e.g. Truck 14."), reason },
    run: (client, args) => client.recruitOperator(args.name, args.reason),
  }),
  tool({
    name: "release_operator",
    description: "Release one operator, by operator_id from the snapshot's roster. An idle one leaves now; a busy one finishes its job first. At most 2 releases a New York day; a 409 means today's limit is reached.",
    inputSchema: { operator_id: z.string().min(1), reason },
    run: (client, args) => client.releaseOperator(args.operator_id, args.reason),
  }),
];
