import { logInfo, logWarn } from "../../logger";
import { ENGINEERING_QUERY_LIMIT_MAX, type EngineeringClientConfig, type FlagEnvironment } from "../../models/engineeringClientConfig";
import {
  CreateFeatureFlagRequestSchema,
  FeatureFlagSchema,
  UpdateFeatureFlagRequestSchema,
  type CreateFeatureFlagRequest,
  type FeatureFlagInput,
} from "../../models/featureFlag";
import { IdTokenProvider, type IdTokenDeps } from "../agentAuth/idTokenProvider";
import { QueryBudget } from "../agentClient/queryBudget";

export interface EngineeringCallResult {
  status: number;
  body: unknown;
}

/** A flag change: any subset of a flag's config, merged onto what it is now. */
export type FlagChange = Partial<FeatureFlagInput>;

interface Endpoint {
  url: string;
  tokens: IdTokenProvider;
}

/**
 * The Software Engineer's client for BoroughSim (docs/17-executive-team.md
 * §22.9), called as the signed-in agent: warehouse queries in its own
 * environment, and flag reads, creates and changes in Test or Prod. One
 * instance serves one run, so it holds that run's query budget.
 */
export class BoroughSimEngineeringClient {
  private readonly fetchFn: typeof fetch;
  private readonly queryBudget: QueryBudget;
  private readonly home: FlagEnvironment;
  private readonly endpoints: Partial<Record<FlagEnvironment, Endpoint>> = {};

  constructor(config: EngineeringClientConfig, deps: IdTokenDeps = {}) {
    this.queryBudget = new QueryBudget(config.ENGINEERING_QUERY_LIMIT ?? ENGINEERING_QUERY_LIMIT_MAX, "BoroughSimEngineeringClient");
    this.fetchFn = deps.fetch ?? fetch;
    const tokenDeps = { fetch: this.fetchFn, now: deps.now };
    this.home = config.AGENT_ENV ?? "PROD";
    this.endpoints[this.home] = {
      url: config.BOROUGH_SIM_API_URL,
      tokens: new IdTokenProvider(
        { idToken: config.AGENT_ID_TOKEN, refreshToken: config.AGENT_REFRESH_TOKEN, clientId: config.AGENT_CLIENT_ID, region: config.AGENT_REGION },
        tokenDeps
      ),
    };
    const { AGENT_OTHER_API_URL: url, AGENT_OTHER_ID_TOKEN: idToken, AGENT_OTHER_REFRESH_TOKEN: refreshToken, AGENT_OTHER_CLIENT_ID: clientId } = config;
    if (url && idToken && refreshToken && clientId) {
      this.endpoints[this.home === "PROD" ? "TEST" : "PROD"] = {
        url,
        tokens: new IdTokenProvider({ idToken, refreshToken, clientId, region: config.AGENT_REGION }, tokenDeps),
      };
    }
  }

  private async call(environment: FlagEnvironment, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<EngineeringCallResult> {
    const endpoint = this.endpoints[environment];
    if (!endpoint) {
      logWarn("BoroughSimEngineeringClient.noSignIn", { environment, method, path });
      return { status: 503, body: { message: `This run has no ${environment} sign-in` } };
    }
    logInfo("BoroughSimEngineeringClient.call", { environment, method, path });
    const response = await this.fetchFn(`${endpoint.url}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await endpoint.tokens.token()}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  /** Runs one read-only SQL query against the warehouse, within the run's budget. */
  runQuery(sql: string): Promise<EngineeringCallResult> {
    return this.queryBudget.run(() => this.call(this.home, "POST", "/admin/warehouse/query", { sql }));
  }

  /** One flag's full config in <environment>: treatments, default, overrides, allocations and version. */
  getFlag(environment: FlagEnvironment, flagKey: string): Promise<EngineeringCallResult> {
    return this.call(environment, "GET", `/feature-flags/${encodeURIComponent(flagKey)}`);
  }

  /** Creates a flag in <environment>; a key that exists is a 409. */
  createFlag(environment: FlagEnvironment, flag: CreateFeatureFlagRequest): Promise<EngineeringCallResult> {
    logInfo("BoroughSimEngineeringClient.createFlag", { environment, flag });
    const request = CreateFeatureFlagRequestSchema.safeParse(flag);
    if (!request.success) {
      logWarn("BoroughSimEngineeringClient.createFlagInvalid", { environment, issues: request.error.issues });
      return Promise.resolve({ status: 400, body: { message: "Invalid flag", issues: request.error.issues } });
    }
    return this.call(environment, "POST", "/admin/feature-flags", request.data);
  }

  /**
   * Changes a flag in <environment>: the fields given replace the current
   * ones, the rest are kept, at the version just read, so a concurrent
   * change is a 409. Allocations `[]` sends everyone to the default.
   */
  async updateFlag(environment: FlagEnvironment, flagKey: string, change: FlagChange): Promise<EngineeringCallResult> {
    logInfo("BoroughSimEngineeringClient.updateFlag", { environment, flagKey, change });
    const current = await this.getFlag(environment, flagKey);
    if (current.status !== 200) return current;
    const flag = FeatureFlagSchema.safeParse(current.body);
    if (!flag.success) {
      logWarn("BoroughSimEngineeringClient.updateFlagUnreadable", { environment, flagKey, issues: flag.error.issues });
      return { status: 502, body: { message: `${flagKey}'s current config could not be read`, issues: flag.error.issues } };
    }
    const { description, treatments, default_treatment, overrides, allocations, version } = flag.data;
    const update = UpdateFeatureFlagRequestSchema.safeParse({
      expected_version: version,
      description,
      treatments,
      default_treatment,
      overrides,
      allocations,
      ...change,
    });
    if (!update.success) {
      logWarn("BoroughSimEngineeringClient.updateFlagInvalid", { environment, flagKey, issues: update.error.issues });
      return { status: 400, body: { message: "Invalid change for this flag", issues: update.error.issues } };
    }
    return this.call(environment, "PUT", `/admin/feature-flags/${encodeURIComponent(flagKey)}`, update.data);
  }
}
