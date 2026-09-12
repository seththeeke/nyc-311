import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1, 10-capacity-modeling-and-integration.md §5.1) — same
 * shape as capacityService. Deliberately minimal: an on-demand trigger
 * for testing purposes only, no output-statistics surface yet (§5.1,
 * explicitly deferred — still being thought through).
 */
export interface SchedulingService {
  runScheduling(): Promise<void>;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error("Not authenticated");
  }
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
}

class LiveSchedulingService implements SchedulingService {
  async runScheduling(): Promise<void> {
    const response = await authorizedFetch("/scheduling/run", { method: "POST" });
    if (!response.ok) {
      throw new Error(`Failed to run scheduling: HTTP ${response.status}`);
    }
  }
}

/** Mock mode has no real Orders/Operators dispatch loop to simulate — a no-op that always succeeds. */
class MockSchedulingService implements SchedulingService {
  async runScheduling(): Promise<void> {
    return Promise.resolve();
  }
}

export const schedulingService: SchedulingService =
  config.dataMode === "live" ? new LiveSchedulingService() : new MockSchedulingService();
