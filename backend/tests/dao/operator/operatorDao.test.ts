import { describe, expect, it } from "vitest";
import { OperatorDao } from "../../../dao/operator/operatorDao";

describe("OperatorDao.getOperator", () => {
  it("returns an Operator with a non-empty operator_id", async () => {
    const operator = await new OperatorDao().getOperator();

    expect(typeof operator.operator_id).toBe("string");
    expect(operator.operator_id.length).toBeGreaterThan(0);
  });

  it("returns a fresh operator_id on every call — fully stateless, never persisted", async () => {
    const dao = new OperatorDao();

    const first = await dao.getOperator();
    const second = await dao.getOperator();

    expect(first.operator_id).not.toBe(second.operator_id);
  });
});
