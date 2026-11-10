import { logInfo } from "../../logger";
import { ENGINEERING_QUERY_LIMIT_MAX, type EngineeringClientConfig } from "../../models/engineeringClientConfig";
import { IdTokenProvider, type IdTokenDeps } from "../agentAuth/idTokenProvider";
import { QueryBudget } from "../agentClient/queryBudget";

export interface EngineeringCallResult {
  status: number;
  body: unknown;
}

/**
 * The Software Engineer's client for BoroughSim (docs/17-executive-team.md
 * §22.9): warehouse queries to measure a ticket's success metric, and flag
 * reads, called as the signed-in agent. Flag changes (`set_flag`) arrive in
 * K3. One instance serves one run, so it holds that run's query budget.
 */
export class BoroughSimEngineeringClient {
  private readonly tokens: IdTokenProvider;
  private readonly fetchFn: typeof fetch;
  private readonly queryBudget: QueryBudget;

  constructor(
    private readonly config: EngineeringClientConfig,
    deps: IdTokenDeps = {}
  ) {
    this.queryBudget = new QueryBudget(config.ENGINEERING_QUERY_LIMIT ?? ENGINEERING_QUERY_LIMIT_MAX, "BoroughSimEngineeringClient");
    this.fetchFn = deps.fetch ?? fetch;
    this.tokens = new IdTokenProvider(
      { idToken: config.AGENT_ID_TOKEN, refreshToken: config.AGENT_REFRESH_TOKEN, clientId: config.AGENT_CLIENT_ID, region: config.AGENT_REGION },
      { fetch: this.fetchFn, now: deps.now }
    );
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<EngineeringCallResult> {
    logInfo("BoroughSimEngineeringClient.call", { method, path });
    const response = await this.fetchFn(`${this.config.BOROUGH_SIM_API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await this.tokens.token()}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  /** Runs one read-only SQL query against the warehouse, within the run's budget. */
  runQuery(sql: string): Promise<EngineeringCallResult> {
    return this.queryBudget.run(() => this.call("POST", "/admin/warehouse/query", { sql }));
  }

  /** One flag's full config: treatments, default, overrides, allocations and version. */
  getFlag(flagKey: string): Promise<EngineeringCallResult> {
    return this.call("GET", `/feature-flags/${encodeURIComponent(flagKey)}`);
  }
}
