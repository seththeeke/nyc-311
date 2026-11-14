import { afterEach, describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import { getOperatorDao } from "../../../dao/operator/getOperatorDao";

describe("getOperatorDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new OperatorDao on every call", () => {
    vi.stubEnv("OPERATORS_TABLE_NAME", "Operators-Test");
    const dao = getOperatorDao();
    expect(dao).toBeInstanceOf(OperatorDao);
    expect(getOperatorDao()).not.toBe(dao);
  });

  it("uses the client it is given", async () => {
    vi.stubEnv("OPERATORS_TABLE_NAME", "Operators-Test");
    const send = vi.fn().mockResolvedValue({});
    await getOperatorDao({ send } as unknown as DynamoDBDocumentClient).getOperator("operator-1");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ TableName: "Operators-Test" }) }));
  });

  it("throws when OPERATORS_TABLE_NAME is missing", () => {
    vi.stubEnv("OPERATORS_TABLE_NAME", "");
    expect(() => getOperatorDao()).toThrow("OPERATORS_TABLE_NAME");
  });
});
