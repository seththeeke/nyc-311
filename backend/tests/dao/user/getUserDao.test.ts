import { afterEach, describe, expect, it, vi } from "vitest";
import { UserDao } from "../../../dao/user/userDao";
import { getUserDao } from "../../../dao/user/getUserDao";

describe("getUserDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new UserDao on every call", () => {
    vi.stubEnv("USERS_TABLE_NAME", "Users-Test");
    const dao = getUserDao();
    expect(dao).toBeInstanceOf(UserDao);
    expect(getUserDao()).not.toBe(dao);
  });

  it("throws when USERS_TABLE_NAME is missing", () => {
    vi.stubEnv("USERS_TABLE_NAME", "");
    expect(() => getUserDao()).toThrow("USERS_TABLE_NAME");
  });
});
