import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactDao } from "../../../dao/contact/contactDao";
import { getContactDao } from "../../../dao/contact/getContactDao";

describe("getContactDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new ContactDao on every call", () => {
    vi.stubEnv("CONTACTS_TABLE_NAME", "Contacts-Test");
    const dao = getContactDao();
    expect(dao).toBeInstanceOf(ContactDao);
    expect(getContactDao()).not.toBe(dao);
  });

  it("throws when CONTACTS_TABLE_NAME is missing", () => {
    vi.stubEnv("CONTACTS_TABLE_NAME", "");
    expect(() => getContactDao()).toThrow("CONTACTS_TABLE_NAME");
  });
});
