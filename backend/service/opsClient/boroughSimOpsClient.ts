import { logInfo } from "../../logger";
import type { OpsClientConfig } from "../../models/opsClientConfig";
import { IdTokenProvider, type IdTokenDeps } from "../agentAuth/idTokenProvider";

export interface OpsCallResult {
  status: number;
  body: unknown;
}

/**
 * The COO's client for BoroughSim's capacity routes (docs/17-executive-team.md
 * §12.3), called as the signed-in agent. Capacity changes are not retried:
 * a recruit has no retry key, and a duplicate would spend a daily change.
 */
export class BoroughSimOpsClient {
  private readonly tokens: IdTokenProvider;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly config: OpsClientConfig,
    deps: IdTokenDeps = {}
  ) {
    this.fetchFn = deps.fetch ?? fetch;
    this.tokens = new IdTokenProvider(
      { idToken: config.AGENT_ID_TOKEN, refreshToken: config.AGENT_REFRESH_TOKEN, clientId: config.AGENT_CLIENT_ID, region: config.AGENT_REGION },
      { fetch: this.fetchFn, now: deps.now }
    );
  }

  private async call(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<OpsCallResult> {
    logInfo("BoroughSimOpsClient.call", { method, path });
    const response = await this.fetchFn(`${this.config.BOROUGH_SIM_API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await this.tokens.token()}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  getCapacitySnapshot(): Promise<OpsCallResult> {
    return this.call("GET", "/capacity/snapshot");
  }

  recruitOperator(name: string, reason: string): Promise<OpsCallResult> {
    return this.call("POST", "/capacity", { name, reason });
  }

  releaseOperator(operatorId: string, reason: string): Promise<OpsCallResult> {
    return this.call("DELETE", `/capacity/${encodeURIComponent(operatorId)}`, { reason });
  }
}
