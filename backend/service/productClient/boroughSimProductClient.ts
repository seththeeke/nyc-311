import { logInfo } from "../../logger";
import { PRODUCT_QUERY_LIMIT_MAX, type ProductClientConfig } from "../../models/productClientConfig";
import { IdTokenProvider, type IdTokenDeps } from "../agentAuth/idTokenProvider";

export interface ProductCallResult {
  status: number;
  body: unknown;
}

export interface ListContactsArgs {
  status?: string;
  order?: string;
  limit?: number;
  cursor?: string;
}

/** The most warehouse queries one CPO run may send (docs/17-executive-team.md §17.11); a run may set fewer. */
export const MAX_QUERIES_PER_RUN = PRODUCT_QUERY_LIMIT_MAX;

export interface UpdateContactArgs {
  contact_id: string;
  status: "IN_PROGRESS" | "CLOSED";
  status_reason_description: string;
  ticket_number?: number;
  closure_reason_code?: string;
}

/**
 * The CPO's client for BoroughSim (docs/17-executive-team.md §17.2): the
 * Contacts list, the contact update, the WBR and ad-hoc warehouse queries,
 * called as the signed-in agent. Nothing here reaches the capacity routes.
 * One instance serves one run, so it holds that run's query budget.
 */
export class BoroughSimProductClient {
  private readonly tokens: IdTokenProvider;
  private readonly fetchFn: typeof fetch;
  private queriesSent = 0;
  private readonly maxQueries: number;

  constructor(
    private readonly config: ProductClientConfig,
    deps: IdTokenDeps = {}
  ) {
    this.maxQueries = config.PRODUCT_QUERY_LIMIT ?? MAX_QUERIES_PER_RUN;
    this.fetchFn = deps.fetch ?? fetch;
    this.tokens = new IdTokenProvider(
      { idToken: config.AGENT_ID_TOKEN, refreshToken: config.AGENT_REFRESH_TOKEN, clientId: config.AGENT_CLIENT_ID, region: config.AGENT_REGION },
      { fetch: this.fetchFn, now: deps.now }
    );
  }

  private async call(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<ProductCallResult> {
    logInfo("BoroughSimProductClient.call", { method, path });
    const response = await this.fetchFn(`${this.config.BOROUGH_SIM_API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await this.tokens.token()}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  listContacts(args: ListContactsArgs): Promise<ProductCallResult> {
    const params = new URLSearchParams({ type: "FEATURE_REQUEST" });
    for (const [key, value] of Object.entries(args)) if (value !== undefined) params.set(key, String(value));
    return this.call("GET", `/contacts?${params.toString()}`);
  }

  updateContact(args: UpdateContactArgs): Promise<ProductCallResult> {
    const { contact_id, ...body } = args;
    return this.call("PATCH", `/admin/contacts/${encodeURIComponent(contact_id)}`, body);
  }

  /**
   * Runs one read-only SQL query against the warehouse. Every call counts
   * against the run's budget, failed ones too; past it, nothing is sent.
   */
  async runQuery(sql: string): Promise<ProductCallResult> {
    if (this.queriesSent >= this.maxQueries) {
      logInfo("BoroughSimProductClient.queryBudgetUsed", { max: this.maxQueries });
      return { status: 429, body: { message: `Query budget used: ${this.maxQueries} of ${this.maxQueries} this run.`, queries_remaining: 0 } };
    }
    this.queriesSent += 1;
    const queriesRemaining = this.maxQueries - this.queriesSent;
    logInfo("BoroughSimProductClient.runQuery", { queriesSent: this.queriesSent, queriesRemaining });
    const result = await this.call("POST", "/admin/warehouse/query", { sql });
    const body = result.body !== null && typeof result.body === "object" ? result.body : { result: result.body };
    return { status: result.status, body: { ...body, queries_remaining: queriesRemaining } };
  }

  /** The newest `weeks` successful runs of the wbr job, with their result rows. */
  async getWbr(weeks: number): Promise<ProductCallResult> {
    const runs = await this.call("GET", "/admin/warehouse/job-runs");
    if (runs.status !== 200) return runs;
    const jobRuns = ((runs.body as { jobRuns?: { job_run_id: string; job_name: string; status: string; started_at: string }[] }).jobRuns ?? [])
      .filter((run) => run.job_name === "wbr" && run.status === "SUCCEEDED")
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, weeks);
    if (jobRuns.length === 0) return { status: 200, body: { runs: [], results: [] } };
    const results = await this.call("POST", "/admin/warehouse/job-runs/results", { job_run_ids: jobRuns.map((run) => run.job_run_id) });
    if (results.status !== 200) return results;
    return { status: 200, body: { runs: jobRuns, results: (results.body as { results: unknown }).results } };
  }
}
