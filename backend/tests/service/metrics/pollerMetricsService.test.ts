import { describe, expect, it, vi } from "vitest";
import { listPollerMetrics } from "../../../service/metrics/pollerMetricsService";
import type { RequestDao } from "../../../dao/request/requestDao";
import type { PollerMetrics } from "../../../models/pollerMetrics";

function fakeRequestDao(metrics: PollerMetrics[]): RequestDao {
  return { listPollerMetrics: vi.fn().mockResolvedValue(metrics) } as unknown as RequestDao;
}

describe("listPollerMetrics", () => {
  it("returns whatever RequestDao.listPollerMetrics resolves with", async () => {
    const metrics: PollerMetrics[] = [
      {
        ran_at: "2026-08-15T00:00:00.000Z",
        success: true,
        records_ingested: 5,
        duplicates_skipped: 0,
        records_rejected: 0,
        error_message: null,
      },
    ];
    const requestDao = fakeRequestDao(metrics);

    await expect(listPollerMetrics({ requestDao })).resolves.toEqual(metrics);
    expect(requestDao.listPollerMetrics).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when no runs have ever been recorded", async () => {
    const requestDao = fakeRequestDao([]);
    await expect(listPollerMetrics({ requestDao })).resolves.toEqual([]);
  });
});
