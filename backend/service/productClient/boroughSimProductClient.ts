import { logInfo } from "../../logger";
import type { OpsClientConfig } from "../../models/opsClientConfig";
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

export interface UpdateContactArgs {
  contact_id: string;
  status: "IN_PROGRESS" | "CLOSED";
  status_reason_description: string;
  ticket_number?: number;
  closure_reason_code?: string;
}

/**
 * The CPO's client for BoroughSim (docs/17-executive-team.md §17.2): the
 * Contacts list, the contact update and the WBR, called as the signed-in
 * agent. Nothing here reaches the capacity routes.
 */
export class BoroughSimProductClient {
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
