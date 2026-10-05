import { DynamoDBDocumentClient, BatchGetCommand, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveWorkspaceMetricsDao } from "../../../dao/analytics/liveWorkspaceMetricsDao";
import type { OperatorDao } from "../../../dao/operator/operatorDao";
import type { OrderDao } from "../../../dao/order/orderDao";
import { ValidationError } from "../../../models/errors";
import type { LiveMetricsDayBucket } from "../../../models/liveWorkspaceMetrics";
import type { OrderEvent, OrderEventType } from "../../../models/order";
import { WorkspaceMetricsSchema } from "../../../models/workspaceMetrics";
import {
  getLiveWorkspaceMetrics,
  recordWorkspaceMetricEvent,
  type LiveWorkspaceMetricsDeps,
} from "../../../service/analytics/liveWorkspaceMetricsService";

function event(eventType: OrderEventType, sequence: number, occurredAt: string, payload: Record<string, unknown> = {}): OrderEvent {
  return {
    order_id: "01ORDER",
    sequence_number: sequence,
    event_type: eventType,
    stage: null,
    payload,
    occurred_at: occurredAt,
    actor: "SYSTEM",
  };
}

/* Created 10:00Z, scheduled 11:00Z, resolved 12:30Z — 2.5h to resolve, 1.5h of labor. */
const CREATED = event("ORDER_CREATED", 0, "2026-10-06T10:00:00.000Z");
const ACCEPTED = event("ORDER_ACCEPTED", 1, "2026-10-06T10:00:05.000Z");
const SCHEDULED = event("ORDER_SCHEDULED", 2, "2026-10-06T11:00:00.000Z", { operator_id: "01OP" });
const RESOLVED = event("ORDER_RESOLVED", 6, "2026-10-06T12:30:00.900Z", { materials_cost_actual: 40.25 });

interface Mocks {
  deps: LiveWorkspaceMetricsDeps;
  recordAccepted: ReturnType<typeof vi.fn>;
  recordResolved: ReturnType<typeof vi.fn>;
  getDayBuckets: ReturnType<typeof vi.fn>;
  listOrderEvents: ReturnType<typeof vi.fn>;
  getOperator: ReturnType<typeof vi.fn>;
}

function mocks(events: OrderEvent[] = [CREATED, ACCEPTED, SCHEDULED, RESOLVED], buckets: LiveMetricsDayBucket[] = []): Mocks {
  const recordAccepted = vi.fn().mockResolvedValue(true);
  const recordResolved = vi.fn().mockResolvedValue(true);
  const getDayBuckets = vi.fn().mockResolvedValue(new Map(buckets.map((bucket) => [bucket.day, bucket])));
  const listOrderEvents = vi.fn().mockResolvedValue(events);
  const getOperator = vi.fn().mockResolvedValue({ operator_id: "01OP", rate_per_hour: 100 });
  return {
    deps: {
      liveWorkspaceMetricsDao: { recordAccepted, recordResolved, getDayBuckets } as unknown as LiveWorkspaceMetricsDao,
      orderDao: { listOrderEvents } as unknown as OrderDao,
      operatorDao: { getOperator } as unknown as OperatorDao,
    },
    recordAccepted,
    recordResolved,
    getDayBuckets,
    listOrderEvents,
    getOperator,
  };
}

function bucket(day: string, overrides: Partial<LiveMetricsDayBucket> = {}): LiveMetricsDayBucket {
  return { metric_key: `DAY#${day}`, day, updated_at: `${day}T12:00:00.000Z`, ...overrides };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordWorkspaceMetricEvent — ORDER_ACCEPTED", () => {
  it("counts the acceptance on its New York day, not its UTC day", async () => {
    const m = mocks();
    /* 02:30Z on the 6th is still 22:30 on the 5th in New York. */
    await recordWorkspaceMetricEvent(event("ORDER_ACCEPTED", 1, "2026-10-06T02:30:00.000Z"), m.deps);

    expect(m.recordAccepted).toHaveBeenCalledWith({ orderId: "01ORDER", day: "2026-10-05" });
    expect(m.listOrderEvents).not.toHaveBeenCalled();
  });

  it("tolerates a duplicate (the DAO reporting it was already counted)", async () => {
    const m = mocks();
    m.recordAccepted.mockResolvedValue(false);

    await expect(recordWorkspaceMetricEvent(ACCEPTED, m.deps)).resolves.toBeUndefined();
  });

  it("rejects an unparseable occurred_at", async () => {
    const m = mocks();

    await expect(recordWorkspaceMetricEvent(event("ORDER_ACCEPTED", 1, "not-a-date"), m.deps)).rejects.toBeInstanceOf(ValidationError);
    expect(m.recordAccepted).not.toHaveBeenCalled();
  });
});

describe("recordWorkspaceMetricEvent — ORDER_RESOLVED", () => {
  it("records created→resolved whole seconds and labor + materials cost, per the wbr job's rules", async () => {
    const m = mocks();

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.getOperator).toHaveBeenCalledWith("01OP");
    /* 9000s to resolve (the .900 truncated); 5400s labor = 1.5h × $100 + $40.25 materials. */
    expect(m.recordResolved).toHaveBeenCalledWith({ orderId: "01ORDER", day: "2026-10-06", resolutionSeconds: 9000, totalCost: 190.25 });
  });

  it("uses the last ORDER_SCHEDULED when an execution failure caused a re-schedule", async () => {
    const rescheduled = event("ORDER_SCHEDULED", 4, "2026-10-06T12:00:00.000Z", { operator_id: "01OP2" });
    const m = mocks([SCHEDULED, CREATED, rescheduled, RESOLVED]);

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.getOperator).toHaveBeenCalledWith("01OP2");
    /* 1800s labor = 0.5h × $100 + $40.25. */
    expect(m.recordResolved.mock.calls[0][0].totalCost).toBe(90.25);
  });

  it("uses the earliest ORDER_CREATED if a rebuild replay duplicated it", async () => {
    const replayed = event("ORDER_CREATED", 0, "2026-10-06T11:30:00.000Z");
    const m = mocks([replayed, CREATED, SCHEDULED, RESOLVED]);

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.recordResolved.mock.calls[0][0].resolutionSeconds).toBe(9000);
  });

  it("counts zero labor when no ORDER_SCHEDULED event exists", async () => {
    const m = mocks([CREATED, RESOLVED]);

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.getOperator).not.toHaveBeenCalled();
    expect(m.recordResolved.mock.calls[0][0].totalCost).toBe(40.25);
  });

  it("counts zero labor when the schedule event carries no operator_id", async () => {
    const m = mocks([CREATED, event("ORDER_SCHEDULED", 2, "2026-10-06T11:00:00.000Z"), RESOLVED]);

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.recordResolved.mock.calls[0][0].totalCost).toBe(40.25);
  });

  it("counts zero labor when the Operator can't be found", async () => {
    const m = mocks();
    m.getOperator.mockResolvedValue(null);

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.recordResolved.mock.calls[0][0].totalCost).toBe(40.25);
  });

  it.each([null, undefined, "12", Number.NaN])("counts zero materials when materials_cost_actual is %s", async (materials) => {
    const m = mocks();

    await recordWorkspaceMetricEvent(event("ORDER_RESOLVED", 6, "2026-10-06T12:30:00.000Z", { materials_cost_actual: materials }), m.deps);

    expect(m.recordResolved.mock.calls[0][0].totalCost).toBe(150);
  });

  it("skips an Order with no ORDER_CREATED event, as the wbr job's inner join does", async () => {
    const m = mocks([SCHEDULED, RESOLVED]);

    await recordWorkspaceMetricEvent(RESOLVED, m.deps);

    expect(m.recordResolved).not.toHaveBeenCalled();
  });

  it("rejects a resolution timestamped before its creation", async () => {
    const m = mocks([event("ORDER_CREATED", 0, "2026-10-07T00:00:00.000Z"), RESOLVED]);

    await expect(recordWorkspaceMetricEvent(RESOLVED, m.deps)).rejects.toBeInstanceOf(ValidationError);
    expect(m.recordResolved).not.toHaveBeenCalled();
  });

  it("tolerates a duplicate resolution", async () => {
    const m = mocks();
    m.recordResolved.mockResolvedValue(false);

    await expect(recordWorkspaceMetricEvent(RESOLVED, m.deps)).resolves.toBeUndefined();
  });
});

describe("recordWorkspaceMetricEvent — other events and defaults", () => {
  it("ignores an event type the queue shouldn't deliver", async () => {
    const m = mocks();

    await recordWorkspaceMetricEvent(SCHEDULED, m.deps);

    expect(m.recordAccepted).not.toHaveBeenCalled();
    expect(m.recordResolved).not.toHaveBeenCalled();
  });

  describe("with default DAOs", () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const item = (orderEvent: OrderEvent): Record<string, unknown> => ({ ...orderEvent, sk: `EVENT#${orderEvent.sequence_number}` });

    beforeEach(() => {
      ddbMock.reset();
      ddbMock.on(TransactWriteCommand).resolves({});
      vi.stubEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME", "LiveWorkspaceMetrics-Test");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("builds its own DAOs from the environment for a resolution", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [CREATED, SCHEDULED, RESOLVED].map(item) });
      ddbMock.on(GetCommand).resolves({});

      await recordWorkspaceMetricEvent(RESOLVED);

      expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input.TableName).toBe("Orders");
      expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.TableName).toBe("Operators");
      const [, update] = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
      expect(update.Update?.TableName).toBe("LiveWorkspaceMetrics-Test");
    });

    it("builds its own DAO for an acceptance and for a read", async () => {
      ddbMock.on(BatchGetCommand).resolves({ Responses: { "LiveWorkspaceMetrics-Test": [] } });

      await recordWorkspaceMetricEvent(ACCEPTED);
      const result = await getLiveWorkspaceMetrics();

      expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(1);
      expect(result.source).toBe("LIVE");
    });

    it("fails loudly when the table name isn't configured", async () => {
      vi.stubEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME", "");

      await expect(recordWorkspaceMetricEvent(ACCEPTED)).rejects.toThrow("LIVE_WORKSPACE_METRICS_TABLE_NAME");
    });
  });
});

describe("getLiveWorkspaceMetrics", () => {
  /* Wednesday 2026-10-07, 11:00 in New York. */
  const WEDNESDAY = (): Date => new Date("2026-10-07T15:00:00.000Z");

  it("sums Monday-through-today against the same days of the previous week", async () => {
    const m = mocks(
      [],
      [
        bucket("2026-10-05", { accepted_count: 10, resolved_count: 2, resolution_seconds_sum: 10800, total_cost_sum: 300.125, resolution_seconds: [3600, 7200] }),
        bucket("2026-10-07", { accepted_count: 5, resolved_count: 1, resolution_seconds_sum: 1800, total_cost_sum: 99.5, resolution_seconds: [1800] }),
        bucket("2026-09-28", { accepted_count: 4, resolved_count: 2, resolution_seconds_sum: 9000, total_cost_sum: 50, resolution_seconds: [1800, 7200] }),
      ]
    );

    const result = await getLiveWorkspaceMetrics({ ...m.deps, now: WEDNESDAY });

    expect(m.getDayBuckets).toHaveBeenCalledWith(["2026-10-05", "2026-10-06", "2026-10-07", "2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(WorkspaceMetricsSchema.parse(result)).toEqual({
      source: "LIVE",
      source_job: "live",
      job_run_id: null,
      computed_at: "2026-10-07T15:00:00.000Z",
      week_start: "2026-10-05",
      previous_week_start: "2026-09-28",
      metrics: {
        REQUESTS_ACCEPTED: { current: 15, previous: 4 },
        SERVICED: { current: 3, previous: 2 },
        /* (10800 + 1800) / 3 / 3600 = 1.17h; previous 9000 / 2 / 3600 = 1.25h. */
        MEAN_TIME_TO_RESOLVE_HOURS: { current: 1.17, previous: 1.25 },
        /* Odd count: the middle of [1800, 3600, 7200]; even count: the mean of [1800, 7200]. */
        MEDIAN_TIME_TO_RESOLVE_HOURS: { current: 1, previous: 1.25 },
        TOTAL_COST: { current: 399.63, previous: 50 },
      },
    });
  });

  it("starts a fresh week at Monday 00:00 New York time: zero counts, no averages", async () => {
    /* 04:00Z Monday = 00:00 Monday in New York; last week's Sunday bucket must not leak in. */
    const m = mocks([], [bucket("2026-10-04", { accepted_count: 99, resolved_count: 9, resolution_seconds: [60] })]);

    const result = await getLiveWorkspaceMetrics({ ...m.deps, now: () => new Date("2026-10-05T04:00:00.000Z") });

    expect(m.getDayBuckets).toHaveBeenCalledWith(["2026-10-05", "2026-09-28"]);
    expect(result.week_start).toBe("2026-10-05");
    expect(result.metrics).toEqual({
      REQUESTS_ACCEPTED: { current: 0, previous: null },
      SERVICED: { current: 0, previous: null },
      MEAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
      MEDIAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
      TOTAL_COST: { current: 0, previous: null },
    });
  });

  it("is still the old week one second before that boundary", async () => {
    const m = mocks();

    const result = await getLiveWorkspaceMetrics({ ...m.deps, now: () => new Date("2026-10-05T03:59:59.000Z") });

    expect(result.week_start).toBe("2026-09-28");
    expect(m.getDayBuckets.mock.calls[0][0]).toHaveLength(14);
  });

  it("reports previous-week zeros (not nulls) once any of its days has a bucket", async () => {
    const m = mocks([], [bucket("2026-09-29", { accepted_count: 2 })]);

    const result = await getLiveWorkspaceMetrics({ ...m.deps, now: WEDNESDAY });

    expect(result.metrics.REQUESTS_ACCEPTED).toEqual({ current: 0, previous: 2 });
    expect(result.metrics.SERVICED).toEqual({ current: 0, previous: 0 });
    expect(result.metrics.MEAN_TIME_TO_RESOLVE_HOURS).toEqual({ current: null, previous: null });
  });
});
