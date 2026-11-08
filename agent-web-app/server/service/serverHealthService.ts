import type { ServerHealth } from "../../shared/models/serverHealth.ts";
import { logInfo } from "../logger.ts";
import { countDirty, currentBranch } from "../source/gitSource.ts";
import { resolveDeps, type ServiceDeps } from "./deps.ts";
import { cloneHealth } from "./healthService.ts";

export async function getServerHealth(serviceDeps: ServiceDeps): Promise<ServerHealth> {
  const { config, run } = resolveDeps(serviceDeps);
  const branch = await currentBranch(config.schedulerClone, run);
  const dirty = await countDirty(config.schedulerClone, run);
  const findings = cloneHealth(config.schedulerClone, branch, dirty);
  logInfo("server health", { branch, dirty, findings: findings.map((f) => f.code) });
  return {
    ok: true,
    logRoot: config.logRoot,
    schedulerClone: config.schedulerClone,
    primaryCheckout: config.primaryCheckout,
    launchAgentsDir: config.launchAgentsDir,
    findings,
  };
}
