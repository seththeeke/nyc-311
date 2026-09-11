import { describe, expect, it } from "vitest";
import { UserSchema } from "../../models/user";

const validUser = {
  user_id: "01H0000000000000000000001",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

describe("UserSchema", () => {
  it("accepts a well-formed User", () => {
    expect(UserSchema.parse(validUser)).toEqual(validUser);
  });

  it("accepts a non-null display_name", () => {
    const withName = { ...validUser, display_name: "Jane Doe" };
    expect(UserSchema.parse(withName)).toEqual(withName);
  });

  it("rejects an unknown type value", () => {
    expect(UserSchema.safeParse({ ...validUser, type: "PUBLIC_ACTOR" }).success).toBe(false);
  });

  it("rejects an unknown status value", () => {
    expect(UserSchema.safeParse({ ...validUser, status: "PENDING" }).success).toBe(false);
  });

  it("rejects a missing cognito_sub", () => {
    const withoutSub: Record<string, unknown> = { ...validUser };
    delete withoutSub.cognito_sub;
    expect(UserSchema.safeParse(withoutSub).success).toBe(false);
  });
});
