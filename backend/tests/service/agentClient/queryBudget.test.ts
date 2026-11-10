import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryBudget } from "../../../service/agentClient/queryBudget";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QueryBudget", () => {
  it("counts every query, failures included, and sends nothing past the budget", async () => {
    const budget = new QueryBudget(2, "Test");
    const send = vi.fn().mockResolvedValueOnce({ status: 400, body: { message: "bad sql" } }).mockResolvedValueOnce({ status: 204, body: null });
    expect(await budget.run(send)).toEqual({ status: 400, body: { message: "bad sql", queries_remaining: 1 } });
    expect(await budget.run(send)).toEqual({ status: 204, body: { result: null, queries_remaining: 0 } });
    expect(await budget.run(send)).toEqual({ status: 429, body: { message: "Query budget used: 2 of 2 this run.", queries_remaining: 0 } });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("refuses every query when the budget is zero", async () => {
    const send = vi.fn();
    expect((await new QueryBudget(0, "Test").run(send)).status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });
});
