import { randomUUID } from "node:crypto";
import { logInfo } from "../../logger";

export interface MockOperatorAssignment {
  operator_id: string;
}

/**
 * Stub (`6-order-scheduling.md` §6): no DynamoDB client at all — fully
 * stateless. Every call returns a fresh, never-persisted operator
 * identity. Moved out of `dao/operator/` (`10-capacity-modeling-and-integration.md`
 * §1.1) — that name now belongs to the real, table-backed `Operator`
 * entity. This stub stays in use here until the real capacity model is
 * wired into scheduling (Leg 1.5, deliberately not yet).
 */
export class MockOperatorAssignmentDao {
  async getOperator(): Promise<MockOperatorAssignment> {
    const operator: MockOperatorAssignment = { operator_id: randomUUID() };
    logInfo("MockOperatorAssignmentDao.getOperator", { operator });
    return operator;
  }
}
