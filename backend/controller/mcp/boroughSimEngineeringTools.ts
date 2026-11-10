import { z } from "zod";
import { ENGINEERING_QUERY_LIMIT_MAX } from "../../models/engineeringClientConfig";
import { FlagKeySchema } from "../../models/featureFlag";
import type { BoroughSimEngineeringClient } from "../../service/engineeringClient/boroughSimEngineeringClient";
import { defineTool, type McpTool } from "./mcpTool";

export type BoroughSimEngineeringTool = McpTool<BoroughSimEngineeringClient>;

const tool = defineTool<BoroughSimEngineeringClient>();

/* The Software Engineer's tools (docs/17-executive-team.md §22.9): warehouse queries and flag reads. set_flag joins in K3. */
export const BOROUGH_SIM_ENGINEERING_TOOLS: readonly BoroughSimEngineeringTool[] = [
  tool({
    name: "run_query",
    description: `Run one read-only Athena SQL query (SELECT/WITH/SHOW/DESCRIBE/EXPLAIN) against the warehouse, e.g. a ticket's success-metric query. At most ${ENGINEERING_QUERY_LIMIT_MAX} per run, failures included; each result says how many remain. Up to 500 rows, 1 GB scanned, 20 s.`,
    inputSchema: { sql: z.string().trim().min(1).max(20_000) },
    run: (client, args) => client.runQuery(args.sql),
  }),
  tool({
    name: "get_flag",
    description: "Read one feature flag's config in this environment: treatments, default treatment, overrides, allocations and version.",
    inputSchema: { flag_key: FlagKeySchema },
    run: (client, args) => client.getFlag(args.flag_key),
  }),
];
