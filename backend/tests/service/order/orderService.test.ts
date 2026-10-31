import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { Order } from "../../../models/order";
import { getOrder } from "../../../service/order/orderService";

const order: Order = {
  order_id: "01K7XWQ2B9N4M8F3T6RZ0Y5DKA",
  request_id: "01K7XW9F0C2A7K5D8S3TQ1M4EB",
  location_id: "3011870001",
  complaint_type: "Street Condition",
  current_stage: "SCHEDULE",
  status: "ACTIVE",
  retry_counts: {},
  priority_tier: "P2",
  sla_deadline: "2026-11-05T00:00:00.000Z",
  scheduled_start: null,
  scheduled_end: null,
  assigned_operator_id: null,
  reassignment_count: 0,
  case_id: null,
  created_at: "2026-10-14T14:03:11.000Z",
  updated_at: "2026-10-14T14:03:12.000Z",
  last_event_sequence: 1,
};

function mockDao(found: Order | null): OrderDao {
  return { getOrder: vi.fn().mockResolvedValue(found) } as unknown as OrderDao;
}

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOrder", () => {
  it("returns the Order's projection", async () => {
    const orderDao = mockDao(order);
    await expect(getOrder(order.order_id, { orderDao })).resolves.toEqual(order);
    expect(orderDao.getOrder).toHaveBeenCalledWith(order.order_id);
  });

  it("returns null when no Order has that id", async () => {
    await expect(getOrder("01K7XWQ2B9N4M8F3T6RZ0Y5DKB", { orderDao: mockDao(null) })).resolves.toBeNull();
  });

  it("builds its own DAO from ORDERS_TABLE_NAME when none is given", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(getOrder(order.order_id)).resolves.toBeNull();
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.TableName).toBe("Orders");
  });
});
