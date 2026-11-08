import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getConfig } from "../../server/config.ts";

/* The repo root holding this package, whatever the checkout is named: agent worktrees live in <repo>-worktrees/<name>, not nyc-311. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("getConfig", () => {
  it("defaults to today's Mac mini layout under HOME", () => {
    const config = getConfig({ HOME: "/h" }, 501);
    expect(config).toMatchObject({
      host: "127.0.0.1", port: 4311, uid: 501, staticDir: null,
      logRoot: "/h/Library/Logs/nyc311-agents", schedulerClone: "/h/agents/nyc-311", launchAgentsDir: "/h/Library/LaunchAgents",
    });
    expect(config.primaryCheckout).toBe(REPO_ROOT);
  });

  it("takes every path from env, and serves the built UI in production", () => {
    const config = getConfig({
      HOME: "/h", AGENT_WEB_APP_PORT: "5000", AGENT_LOG_ROOT: "/l", AGENT_SCHEDULER_CLONE: "/c",
      AGENT_PRIMARY_CHECKOUT: "/p", AGENT_LAUNCH_AGENTS_DIR: "/a", NODE_ENV: "production",
    }, 1);
    expect(config).toMatchObject({ port: 5000, logRoot: "/l", schedulerClone: "/c", primaryCheckout: "/p", launchAgentsDir: "/a" });
    expect(config.staticDir).toMatch(/dist\/web$/);
  });

  it("falls back to the OS home dir and uid", () => {
    expect(getConfig({}).logRoot).toMatch(/Library\/Logs\/nyc311-agents$/);
  });
});
