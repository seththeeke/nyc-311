import { describe, expect, it } from "vitest";
import { MockOperatorAssignmentDao } from "../../../dao/scheduling/mockOperatorAssignmentDao";

describe("MockOperatorAssignmentDao.getOperator", () => {
  it("returns an operator_id", async () => {
    const operator = await new MockOperatorAssignmentDao().getOperator();

    expect(typeof operator.operator_id).toBe("string");
    expect(operator.operator_id.length).toBeGreaterThan(0);
  });

  it("returns a fresh operator_id on every call — fully stateless, never persisted", async () => {
    const dao = new MockOperatorAssignmentDao();

    const first = await dao.getOperator();
    const second = await dao.getOperator();

    expect(first.operator_id).not.toBe(second.operator_id);
  });
});
