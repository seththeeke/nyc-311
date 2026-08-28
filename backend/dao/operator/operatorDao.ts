import { randomUUID } from "node:crypto";
import type { Operator } from "../../models/operator";
import { logInfo } from "../../logger";

/**
 * Stub (`6-order-scheduling.md` §6): no `Operators` table, no DynamoDB
 * client at all — fully stateless. Every call returns a fresh, never-
 * persisted operator identity. Deliberately shaped like this project's
 * other DAOs (a class, a lazy `getOperatorDao()` construction helper) so a
 * real, table-backed implementation can swap in later without callers
 * changing, even though there's nothing to construct today.
 */
export class OperatorDao {
  async getOperator(): Promise<Operator> {
    const operator: Operator = { operator_id: randomUUID() };
    logInfo("OperatorDao.getOperator", { operator });
    return operator;
  }
}
