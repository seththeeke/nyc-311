import type { ServerConfig } from "../config.ts";
import { runCommand, type CommandRunner } from "../source/commandRunner.ts";
import { createLaunchdLogRunSource, isPidAlive, type PidCheck } from "../source/launchdLogRunSource.ts";
import type { RunSource } from "../source/runSource.ts";

/** What every service needs. Only `config` is required; the rest default to the real machine and are swapped in tests. */
export interface ServiceDeps {
  config: ServerConfig;
  run?: CommandRunner;
  runSource?: RunSource;
  pidCheck?: PidCheck;
  now?: () => Date;
}

export interface ResolvedDeps {
  config: ServerConfig;
  run: CommandRunner;
  runSource: RunSource;
  pidCheck: PidCheck;
  now: () => Date;
}

/** Fills in defaults per call, never at module scope (backend §5.2's lazy-construction rule). */
export function resolveDeps(deps: ServiceDeps): ResolvedDeps {
  const pidCheck = deps.pidCheck ?? isPidAlive;
  return {
    config: deps.config,
    run: deps.run ?? runCommand,
    runSource: deps.runSource ?? createLaunchdLogRunSource(deps.config.logRoot, pidCheck),
    pidCheck,
    now: deps.now ?? (() => new Date()),
  };
}
