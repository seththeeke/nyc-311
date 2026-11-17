import { z } from "zod";

/*
 * An empty string means unset: the field is dropped, so it never
 * overwrites a build-time default with "".
 */
const OptionalValueSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

/*
 * The deploy-time `/env-config.json` that cdk/web/WebsiteDeployment.ts
 * writes next to the built SPA, one per environment. Parsed in config.ts so
 * the app's one runtime-config read is validated like every other network
 * read (CLAUDE.md §5.1).
 */
export const RuntimeEnvConfigSchema = z.object({
  apiBaseUrl: OptionalValueSchema,
  publicApiBaseUrl: OptionalValueSchema,
  chatApiBaseUrl: OptionalValueSchema,
  userPoolId: OptionalValueSchema,
  userPoolClientId: OptionalValueSchema,
});
export type RuntimeEnvConfig = z.infer<typeof RuntimeEnvConfigSchema>;
