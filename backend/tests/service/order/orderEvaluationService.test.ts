import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateOrder,
  fanOutOrderEvent,
  RandomOrderEvaluationRule,
  type OrderEvaluationRule,
} from "../../../service/order/orderEvaluationService";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { OrderPriorityAssigner } from "../../../service/order/orderPriorityService";
import type { createCase } from "../../../service/case/caseService";
import type { Order, OrderEvent } from "../../../models/order";
import type { OrderStreamRecord } from "../../../models/orderStreamEvent";

const TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:Nyc311OrderEvents-Test";
const snsMock = mockClient(SNSClient);
const snsClient = new SNSClient({});

function makeStreamRecord(overrides: Partial<OrderStreamRecord> = {}): OrderStreamRecord {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: {
        order_id: { S: "01ORDER" },
        sk: { S: "EVENT#0" },
        event_type: { S: "ORDER_CREATED" },
      },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

beforeEach(() => {
  snsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOutOrderEvent", () => {
  it("publishes the unmarshalled EVENT# item to SNS, tagged with its event_type message attribute", async () => {
    snsMock.on(PublishCommand).resolves({});

    await fanOutOrderEvent(makeStreamRecord(), { snsClient, topicArn: TOPIC_ARN });

    const calls = snsMock.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.TopicArn).toBe(TOPIC_ARN);
    expect(JSON.parse(input?.Message as string)).toEqual({
      order_id: "01ORDER",
      sk: "EVENT#0",
      event_type: "ORDER_CREATED",
    });
    expect(input?.MessageAttributes).toEqual({
      event_type: { DataType: "String", StringValue: "ORDER_CREATED" },
    });
  });

  it("skips a MODIFY record (the #METADATA projection's own update) without publishing anything", async () => {
    await fanOutOrderEvent(makeStreamRecord({ eventName: "MODIFY" }), { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips a REMOVE record without publishing anything", async () => {
    await fanOutOrderEvent(makeStreamRecord({ eventName: "REMOVE" }), { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record with no NewImage at all (e.g. KEYS_ONLY delivery)", async () => {
    await fanOutOrderEvent(
      { eventName: "INSERT", dynamodb: { SequenceNumber: "111" } },
      { snsClient, topicArn: TOPIC_ARN }
    );

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT of the #METADATA projection item (sk doesn't start with EVENT#)", async () => {
    const record = makeStreamRecord({
      dynamodb: {
        NewImage: { order_id: { S: "01ORDER" }, sk: { S: "#METADATA" }, status: { S: "CREATED" } },
        SequenceNumber: "222",
      },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose NewImage has no sk attribute at all", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { order_id: { S: "01ORDER" } }, SequenceNumber: "333" },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose sk attribute isn't a string (S) AttributeValue", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { order_id: { S: "01ORDER" }, sk: { N: "1" } }, SequenceNumber: "444" },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("tags a missing/non-string event_type as UNKNOWN rather than throwing", async () => {
    snsMock.on(PublishCommand).resolves({});
    const record = makeStreamRecord({
      dynamodb: {
        NewImage: { order_id: { S: "01ORDER" }, sk: { S: "EVENT#0" } },
        SequenceNumber: "555",
      },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    const input = snsMock.commandCalls(PublishCommand)[0]?.args[0].input;
    expect(input?.MessageAttributes).toEqual({
      event_type: { DataType: "String", StringValue: "UNKNOWN" },
    });
  });

  it("lets an SNS Publish failure propagate", async () => {
    snsMock.on(PublishCommand).rejects(new Error("SNS unavailable"));

    await expect(fanOutOrderEvent(makeStreamRecord(), { snsClient, topicArn: TOPIC_ARN })).rejects.toThrow(
      "SNS unavailable"
    );
  });

  it("throws when topicArn isn't provided and ORDER_EVENTS_TOPIC_ARN isn't set", async () => {
    const previous = process.env["ORDER_EVENTS_TOPIC_ARN"];
    delete process.env["ORDER_EVENTS_TOPIC_ARN"];

    try {
      await expect(fanOutOrderEvent(makeStreamRecord(), { snsClient })).rejects.toThrow(
        "Missing required environment variable: ORDER_EVENTS_TOPIC_ARN"
      );
    } finally {
      if (previous !== undefined) process.env["ORDER_EVENTS_TOPIC_ARN"] = previous;
    }
  });

  it("falls back to ORDER_EVENTS_TOPIC_ARN when topicArn isn't provided in deps", async () => {
    const previous = process.env["ORDER_EVENTS_TOPIC_ARN"];
    process.env["ORDER_EVENTS_TOPIC_ARN"] = TOPIC_ARN;
    snsMock.on(PublishCommand).resolves({});

    try {
      await fanOutOrderEvent(makeStreamRecord(), { snsClient });

      const calls = snsMock.commandCalls(PublishCommand);
      expect(calls[0]?.args[0].input.TopicArn).toBe(TOPIC_ARN);
    } finally {
      if (previous === undefined) delete process.env["ORDER_EVENTS_TOPIC_ARN"];
      else process.env["ORDER_EVENTS_TOPIC_ARN"] = previous;
    }
  });

  it("falls back to a freshly constructed SNSClient when snsClient isn't provided in deps", async () => {
    const previous = process.env["ORDER_EVENTS_TOPIC_ARN"];
    process.env["ORDER_EVENTS_TOPIC_ARN"] = TOPIC_ARN;
    snsMock.on(PublishCommand).resolves({});

    try {
      await fanOutOrderEvent(makeStreamRecord());

      expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env["ORDER_EVENTS_TOPIC_ARN"];
      else process.env["ORDER_EVENTS_TOPIC_ARN"] = previous;
    }
  });
});

describe("RandomOrderEvaluationRule", () => {
  it("returns ACCEPT for a draw below 0.8", async () => {
    const rule = new RandomOrderEvaluationRule({ random: () => 0.5 });
    await expect(rule.evaluate()).resolves.toBe("ACCEPT");
  });

  it("returns ACCEPT for a draw just below the 0.8 boundary", async () => {
    const rule = new RandomOrderEvaluationRule({ random: () => 0.7999 });
    await expect(rule.evaluate()).resolves.toBe("ACCEPT");
  });

  it("returns REJECT for a draw at the 0.8 boundary and just below 0.99", async () => {
    const rule = new RandomOrderEvaluationRule({ random: () => 0.8 });
    await expect(rule.evaluate()).resolves.toBe("REJECT");
    const rule2 = new RandomOrderEvaluationRule({ random: () => 0.9899 });
    await expect(rule2.evaluate()).resolves.toBe("REJECT");
  });

  it("returns CASE for a draw at or above 0.99", async () => {
    const rule = new RandomOrderEvaluationRule({ random: () => 0.99 });
    await expect(rule.evaluate()).resolves.toBe("CASE");
    const rule2 = new RandomOrderEvaluationRule({ random: () => 0.999999 });
    await expect(rule2.evaluate()).resolves.toBe("CASE");
  });

  it("defaults `random` to Math.random when not injected", async () => {
    const rule = new RandomOrderEvaluationRule();
    await expect(["ACCEPT", "REJECT", "CASE"]).toContain(await rule.evaluate());
  });
});

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    order_id: "01ORDER",
    request_id: "01REQUEST",
    location_id: "1234567890",
    current_stage: "INGEST",
    status: "CREATED",
    retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
    priority_tier: null,
    sla_deadline: null,
    scheduled_start: null,
    scheduled_end: null,
    assigned_operator_id: null,
    reassignment_count: 0,
    case_id: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    last_event_sequence: 0,
    ...overrides,
  };
}

function makeOrderEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    order_id: "01ORDER",
    sequence_number: 0,
    event_type: "ORDER_CREATED",
    stage: null,
    payload: {},
    occurred_at: "2026-08-20T00:00:00.000Z",
    actor: "SYSTEM",
    ...overrides,
  };
}

describe("evaluateOrder", () => {
  function makeDaoMock(order: Order | null): OrderDao {
    return {
      getOrder: vi.fn().mockResolvedValue(order),
      acceptOrder: vi.fn().mockResolvedValue(undefined),
      rejectOrder: vi.fn().mockResolvedValue(undefined),
      recordCaseCreated: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderDao;
  }

  function makeRule(outcome: "ACCEPT" | "REJECT" | "CASE"): OrderEvaluationRule {
    return { evaluate: vi.fn().mockResolvedValue(outcome) };
  }

  function makePriorityAssigner(): OrderPriorityAssigner {
    return { assign: vi.fn().mockResolvedValue({ priorityTier: "STANDARD", slaDeadline: "2026-08-27T00:00:00.000Z" }) };
  }

  it("no-ops when the Order doesn't exist yet", async () => {
    const orderDao = makeDaoMock(null);

    await evaluateOrder(makeOrderEvent(), { orderDao, rule: makeRule("ACCEPT"), priorityAssigner: makePriorityAssigner() });

    expect(orderDao.acceptOrder).not.toHaveBeenCalled();
  });

  it("no-ops when status is no longer CREATED (already evaluated)", async () => {
    const orderDao = makeDaoMock(makeOrder({ status: "ACTIVE" }));
    const rule = makeRule("ACCEPT");

    await evaluateOrder(makeOrderEvent(), { orderDao, rule, priorityAssigner: makePriorityAssigner() });

    expect(rule.evaluate).not.toHaveBeenCalled();
    expect(orderDao.acceptOrder).not.toHaveBeenCalled();
  });

  it("no-ops when case_id is already set (CASE outcome already recorded), even though status is still CREATED", async () => {
    const orderDao = makeDaoMock(makeOrder({ case_id: "some-case" }));
    const rule = makeRule("ACCEPT");

    await evaluateOrder(makeOrderEvent(), { orderDao, rule, priorityAssigner: makePriorityAssigner() });

    expect(rule.evaluate).not.toHaveBeenCalled();
  });

  it("calls acceptOrder with the assigned priority/SLA on ACCEPT", async () => {
    const orderDao = makeDaoMock(makeOrder());
    const priorityAssigner = makePriorityAssigner();

    await evaluateOrder(makeOrderEvent(), { orderDao, rule: makeRule("ACCEPT"), priorityAssigner });

    expect(orderDao.acceptOrder).toHaveBeenCalledWith("01ORDER", {
      priorityTier: "STANDARD",
      slaDeadline: "2026-08-27T00:00:00.000Z",
    });
  });

  it("calls rejectOrder on REJECT", async () => {
    const orderDao = makeDaoMock(makeOrder());

    await evaluateOrder(makeOrderEvent(), { orderDao, rule: makeRule("REJECT"), priorityAssigner: makePriorityAssigner() });

    expect(orderDao.rejectOrder).toHaveBeenCalledWith("01ORDER", expect.any(String));
  });

  it("calls createCase and recordCaseCreated on CASE", async () => {
    const orderDao = makeDaoMock(makeOrder());
    const createCaseFn = vi.fn().mockResolvedValue(undefined) as unknown as typeof createCase;

    await evaluateOrder(makeOrderEvent(), {
      orderDao,
      rule: makeRule("CASE"),
      priorityAssigner: makePriorityAssigner(),
      createCaseFn,
    });

    expect(createCaseFn).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "01ORDER", request_id: null, case_type: "WORKFLOW_EXECUTION_FAILURE" })
    );
    expect(orderDao.recordCaseCreated).toHaveBeenCalledWith("01ORDER", expect.any(String));
  });

  it("defaults rule/priorityAssigner/createCaseFn to the module's own instances, still using an injected orderDao", async () => {
    const orderDao = makeDaoMock(makeOrder());

    await evaluateOrder(makeOrderEvent(), { orderDao });

    /* The real RandomOrderEvaluationRule/MockOrderPriorityAssigner ran — one of the three outcome DAO calls fired. */
    const called = [orderDao.acceptOrder, orderDao.rejectOrder, orderDao.recordCaseCreated].some(
      (fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length > 0
    );
    expect(called).toBe(true);
  });

  it("throws when deps.orderDao is omitted and ORDERS_TABLE_NAME isn't set", async () => {
    const previous = process.env["ORDERS_TABLE_NAME"];
    delete process.env["ORDERS_TABLE_NAME"];

    try {
      await expect(evaluateOrder(makeOrderEvent())).rejects.toThrow(
        "Missing required environment variable: ORDERS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env["ORDERS_TABLE_NAME"] = previous;
    }
  });
});
