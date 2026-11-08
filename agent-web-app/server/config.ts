import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Where the server listens and what it reads. Every path defaults to today's Mac mini layout (SPEC.md §3.5) and is overridable by env. */
export interface ServerConfig {
  host: string;
  port: number;
  logRoot: string;
  schedulerClone: string;
  primaryCheckout: string;
  launchAgentsDir: string;
  uid: number;
  staticDir: string | null;
}

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getConfig(env: NodeJS.ProcessEnv = process.env, uid: number = os.userInfo().uid): ServerConfig {
  const home = env.HOME ?? os.homedir();
  return {
    host: "127.0.0.1",
    port: Number(env.AGENT_WEB_APP_PORT ?? 4311),
    logRoot: env.AGENT_LOG_ROOT ?? path.join(home, "Library/Logs/nyc311-agents"),
    schedulerClone: env.AGENT_SCHEDULER_CLONE ?? path.join(home, "agents/nyc-311"),
    primaryCheckout: env.AGENT_PRIMARY_CHECKOUT ?? path.resolve(PACKAGE_ROOT, ".."),
    launchAgentsDir: env.AGENT_LAUNCH_AGENTS_DIR ?? path.join(home, "Library/LaunchAgents"),
    uid,
    staticDir: env.NODE_ENV === "production" ? path.join(PACKAGE_ROOT, "dist/web") : null,
  };
}
