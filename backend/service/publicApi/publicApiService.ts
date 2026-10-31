import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logInfo } from "../../logger";

/*
 * The public API's service layer (16-resident-action-models.md §2.3):
 * public model in, domain service calls, public model out. Calls domain
 * services only, never a DAO; every public controller goes through it.
 */

export interface GetOpenApiSpecDeps {
  /* Where the spec is; the Lambda bundle carries it beside the handler. */
  specPath?: string;
}

/** The hand-maintained OpenAPI document, as YAML text. */
export async function getOpenApiSpec(deps: GetOpenApiSpecDeps = {}): Promise<string> {
  const specPath = deps.specPath ?? join(__dirname, "openapi.yaml");
  const spec = await readFile(specPath, "utf8");
  logInfo("PublicApiSpecRead", { specPath, bytes: spec.length });
  return spec;
}
