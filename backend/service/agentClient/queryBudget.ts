import { logInfo } from "../../logger";

export interface QueryBudgetResult {
  status: number;
  body: unknown;
}

/**
 * One agent run's warehouse query budget (docs/17-executive-team.md §17.11,
 * §22.9). Every query counts, failed ones too; past the budget nothing is
 * sent, and each result says how many remain.
 */
export class QueryBudget {
  private sent = 0;

  constructor(
    private readonly max: number,
    private readonly logName: string
  ) {}

  /** Runs `send` if the budget allows, adding `queries_remaining` to its body; otherwise a 429 without sending. */
  async run(send: () => Promise<QueryBudgetResult>): Promise<QueryBudgetResult> {
    if (this.sent >= this.max) {
      logInfo(`${this.logName}.queryBudgetUsed`, { max: this.max });
      return { status: 429, body: { message: `Query budget used: ${this.max} of ${this.max} this run.`, queries_remaining: 0 } };
    }
    this.sent += 1;
    const queriesRemaining = this.max - this.sent;
    logInfo(`${this.logName}.runQuery`, { queriesSent: this.sent, queriesRemaining });
    const result = await send();
    const body = result.body !== null && typeof result.body === "object" ? result.body : { result: result.body };
    return { status: result.status, body: { ...body, queries_remaining: queriesRemaining } };
  }
}
