import { z } from "zod";
import { ENGINEERING_QUERY_LIMIT_MAX, FlagEnvironmentSchema } from "../../models/engineeringClientConfig";
import { FeatureFlagAllocationSchema, FeatureFlagOverrideSchema, FlagKeySchema } from "../../models/featureFlag";
import type { BoroughSimEngineeringClient } from "../../service/engineeringClient/boroughSimEngineeringClient";
import { defineTool, type McpTool } from "./mcpTool";

export type BoroughSimEngineeringTool = McpTool<BoroughSimEngineeringClient>;

const tool = defineTool<BoroughSimEngineeringClient>();

const environment = FlagEnvironmentSchema.describe("TEST or PROD");
const treatment = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/, "ALL_CAPS");
const flagFields = {
  description: z.string().max(500),
  treatments: z.array(treatment).min(1).max(10),
  default_treatment: treatment,
  overrides: z.array(FeatureFlagOverrideSchema).max(100),
  allocations: z.array(FeatureFlagAllocationSchema).max(10),
};

/* The Software Engineer's tools (docs/17-executive-team.md §22.9): warehouse queries, and flag reads, creates and changes in Test and Prod. */
export const BOROUGH_SIM_ENGINEERING_TOOLS: readonly BoroughSimEngineeringTool[] = [
  tool({
    name: "run_query",
    description: `Run one read-only Athena SQL query (SELECT/WITH/SHOW/DESCRIBE/EXPLAIN) against the warehouse, e.g. a ticket's success-metric query. At most ${ENGINEERING_QUERY_LIMIT_MAX} per run, failures included; each result says how many remain. Up to 500 rows, 1 GB scanned, 20 s.`,
    inputSchema: { sql: z.string().trim().min(1).max(20_000) },
    run: (client, args) => client.runQuery(args.sql),
  }),
  tool({
    name: "get_flag",
    description: "Read one feature flag's config in TEST or PROD: treatments, default treatment, overrides, allocations and version. A missing flag is a 404.",
    inputSchema: { environment, flag_key: FlagKeySchema },
    run: (client, args) => client.getFlag(args.environment, args.flag_key),
  }),
  tool({
    name: "create_flag",
    description:
      "Create a feature flag in TEST or PROD, e.g. treatments [\"C\", \"T1\"] with default_treatment \"T1\" in TEST and \"C\" in PROD, no overrides and no allocations. An existing key is a 409.",
    inputSchema: { environment, flag_key: FlagKeySchema, ...flagFields, overrides: flagFields.overrides.default([]), allocations: flagFields.allocations.default([]) },
    run: (client, { environment: env, ...flag }) => client.createFlag(env, flag),
  }),
  tool({
    name: "update_flag",
    description:
      "Change a feature flag in TEST or PROD. Give only the fields to change; the rest are kept. A dial-up step is allocations [{treatment: \"T1\", percent: 100}]; allocations [] rolls everyone back to the default treatment. A concurrent change is a 409: read it again and retry.",
    inputSchema: {
      environment,
      flag_key: FlagKeySchema,
      description: flagFields.description.optional(),
      treatments: flagFields.treatments.optional(),
      default_treatment: flagFields.default_treatment.optional(),
      overrides: flagFields.overrides.optional(),
      allocations: flagFields.allocations.optional(),
    },
    run: (client, { environment: env, flag_key, ...change }) =>
      client.updateFlag(env, flag_key, Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined))),
  }),
];
