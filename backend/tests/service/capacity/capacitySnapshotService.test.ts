import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveWorkspaceMetricsDao } from "../../../dao/analytics/liveWorkspaceMetricsDao";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import { OrderDao } from "../../../dao/order/orderDao";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";
import type { Operator } from "../../../models/operator";
import { TARGET_MEDIAN_DAYS, getCapacitySnapshot } from "../../../service/capacity/capacitySnapshotService";

const NOW = new Date("2026-11-01T14:00:00.000Z");
const DAY = 86_400;

function operator(id: string, overrides: Partial<Operator> = {}): Operator {
  return { operator_id: id, name: id, status: "ACTIVE", current_activity: "IDLE", removal_requested_at: null, start_datetime: "2026-10-01T00:00:00.000Z", end_datetime: null, rate_per_hour: 45, current_location: HOME_DEPOT_LOCATION, last_event_sequence: 0, ...overrides };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCapacitySnapshot", () => {
  it("reports fleet, medians, flow, backlog, spend and caps, recommending nothing", async () => {
    const roster = [operator("A"), operator("B", { current_activity: "WORKING" }), operator("C", { removal_requested_at: "2026-11-01T09:00:00.000Z" })];
    const operatorDao = { listActiveRoster: vi.fn().mockResolvedValue(roster), listRoster: vi.fn().mockResolvedValue(roster) } as unknown as OperatorDao;
    const listOrdersWaitingForSchedule = vi
      .fn()
      .mockResolvedValueOnce({ orders: [{ created_at: "2026-10-30T10:00:00.000Z" }, { created_at: "2026-10-29T10:00:00.000Z" }], nextCursor: "next" })
      .mockResolvedValueOnce({ orders: [{ created_at: "2026-10-31T10:00:00.000Z" }], nextCursor: null });
    const buckets = new Map([
      ["2026-11-01", { day: "2026-11-01", accepted_count: 10, resolved_count: 3, resolution_seconds: [DAY, 2 * DAY, 3 * DAY] }],
      ["2026-10-31", { day: "2026-10-31", resolved_count: 1, resolution_seconds: [4 * DAY] }],
      ["2026-10-20", { day: "2026-10-20", resolved_count: 1, resolution_seconds: [10 * DAY] }],
    ]);
    const metricsDao = { getDayBuckets: vi.fn().mockResolvedValue(buckets) } as unknown as LiveWorkspaceMetricsDao;

    const snapshot = await getCapacitySnapshot({ operatorDao, orderDao: { listOrdersWaitingForSchedule } as unknown as OrderDao, metricsDao, now: () => NOW });

    expect(snapshot).toMatchObject({
      computed_at: NOW.toISOString(),
      target_median_days: TARGET_MEDIAN_DAYS,
      fleet: { size: 3, idle: 1, busy: 1 },
      median_days_to_resolve_7d: 2.5,
      backlog: { waiting_to_schedule: 3, oldest_waiting_since: "2026-10-29T10:00:00.000Z" },
      hourly_burn_rate: 135,
      limits: { recruits_today: 0, releases_today: 0, day: "2026-11-01" },
    });
    expect(snapshot.days).toHaveLength(14);
    expect(snapshot.days[0]).toEqual({ day: "2026-11-01", accepted_count: 10, resolved_count: 3, median_days_to_resolve: 2 });
    expect(snapshot.days[1]).toEqual({ day: "2026-10-31", accepted_count: 0, resolved_count: 1, median_days_to_resolve: 4 });
    expect(snapshot.days[2]).toEqual({ day: "2026-10-30", accepted_count: 0, resolved_count: 0, median_days_to_resolve: null });
    expect(listOrdersWaitingForSchedule).toHaveBeenLastCalledWith({ limit: 500, cursor: "next" });
  });

  it("reports nulls with no resolutions and no backlog, using the default DAOs and clock", async () => {
    vi.spyOn(OperatorDao.prototype, "listActiveRoster").mockResolvedValue([]);
    vi.spyOn(OperatorDao.prototype, "listRoster").mockResolvedValue([]);
    vi.spyOn(OrderDao.prototype, "listOrdersWaitingForSchedule").mockResolvedValue({ orders: [], nextCursor: null });
    vi.spyOn(LiveWorkspaceMetricsDao.prototype, "getDayBuckets").mockResolvedValue(new Map());
    process.env.LIVE_WORKSPACE_METRICS_TABLE_NAME = "LiveWorkspaceMetrics";
    const snapshot = await getCapacitySnapshot();
    delete process.env.LIVE_WORKSPACE_METRICS_TABLE_NAME;
    expect(snapshot).toMatchObject({ median_days_to_resolve_7d: null, backlog: { waiting_to_schedule: 0, oldest_waiting_since: null }, fleet: { size: 0 } });
  });
});
