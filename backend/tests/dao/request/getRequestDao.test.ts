import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestDao } from "../../../dao/request/requestDao";
import { getRequestDao } from "../../../dao/request/getRequestDao";

describe("getRequestDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new RequestDao on every call", () => {
    vi.stubEnv("REQUESTS_TABLE_NAME", "Requests-Test");
    const dao = getRequestDao();
    expect(dao).toBeInstanceOf(RequestDao);
    expect(getRequestDao()).not.toBe(dao);
  });

  it("throws when REQUESTS_TABLE_NAME is missing", () => {
    vi.stubEnv("REQUESTS_TABLE_NAME", "");
    expect(() => getRequestDao()).toThrow("REQUESTS_TABLE_NAME");
  });
});
