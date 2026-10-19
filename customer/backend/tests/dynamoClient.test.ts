import { describe, expect, it } from "vitest";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDocumentClient } from "../dynamoClient";

describe("createDocumentClient", () => {
  it("returns a DynamoDBDocumentClient", () => {
    expect(createDocumentClient()).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it("returns a fresh client on every call, never a shared singleton", () => {
    expect(createDocumentClient()).not.toBe(createDocumentClient());
  });
});
