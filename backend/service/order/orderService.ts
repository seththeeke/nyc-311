import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { createDocumentClient } from "../../dynamoClient";
import { OrderDao } from "../../dao/order/orderDao";
import type { Order } from "../../models/order";

/* Lazily constructed per CLAUDE.md §5.2 — never a module-scope singleton. */
function getOrderDao(): OrderDao {
  return new OrderDao(createDocumentClient(), requireEnv("ORDERS_TABLE_NAME"));
}

export interface OrderServiceDeps {
  orderDao?: OrderDao;
}

/**
 * One Order's current projection, or `null` when no Order has that id. A
 * missing Order isn't an error here: the public search
 * (`16-resident-action-models.md` §2.4.1) answers it with an empty list.
 */
export async function getOrder(orderId: string, deps: OrderServiceDeps = {}): Promise<Order | null> {
  const orderDao = deps.orderDao ?? getOrderDao();
  const order = await orderDao.getOrder(orderId);
  if (!order) {
    logInfo("OrderNotFound", { orderId });
    return null;
  }
  logInfo("OrderFetched", { orderId, status: order.status, currentStage: order.current_stage });
  return order;
}
