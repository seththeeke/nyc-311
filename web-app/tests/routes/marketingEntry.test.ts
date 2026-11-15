import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMarketingEntry,
  getMarketingEntryVersion,
  MARKETING_ENTERED_AT_KEY,
  MARKETING_ENTERED_KEY,
  MARKETING_ENTRY_TTL_MS,
  readMarketingEntry,
  subscribeMarketingEntry,
  writeMarketingEntry,
} from "../../src/routes/marketingEntry";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60 * 1000;

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("marketingEntry on C (not sticky)", () => {
  it("reads and writes the tab's session key only, never localStorage", () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    expect(readMarketingEntry(false, NOW)).toBe(false);
    writeMarketingEntry(false, NOW);
    expect(window.sessionStorage.getItem(MARKETING_ENTERED_KEY)).toBe("1");
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
    expect(readMarketingEntry(false, NOW)).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores a stored entry", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, ago(MINUTE));
    expect(readMarketingEntry(false, NOW)).toBe(false);
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBe(ago(MINUTE));
  });
});

describe("marketingEntry on T1 (sticky)", () => {
  it("writes both stores on entry", () => {
    writeMarketingEntry(true, NOW);
    expect(window.sessionStorage.getItem(MARKETING_ENTERED_KEY)).toBe("1");
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBe(NOW.toISOString());
  });

  it("is not entered with nothing stored", () => {
    expect(readMarketingEntry(true, NOW)).toBe(false);
  });

  it("honors the tab's session key alone", () => {
    window.sessionStorage.setItem(MARKETING_ENTERED_KEY, "1");
    expect(readMarketingEntry(true, NOW)).toBe(true);
  });

  it("honors a stored entry and refreshes its timestamp", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, ago(3 * 24 * 60 * MINUTE));
    expect(readMarketingEntry(true, NOW)).toBe(true);
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBe(NOW.toISOString());
  });

  it("keeps an entry one minute short of 7 days", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, ago(MARKETING_ENTRY_TTL_MS - MINUTE));
    expect(readMarketingEntry(true, NOW)).toBe(true);
  });

  it("keeps an entry exactly 7 days old (expiry is strictly more than 7 days)", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, ago(MARKETING_ENTRY_TTL_MS));
    expect(readMarketingEntry(true, NOW)).toBe(true);
  });

  it("drops an entry one minute past 7 days", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, ago(MARKETING_ENTRY_TTL_MS + MINUTE));
    expect(readMarketingEntry(true, NOW)).toBe(false);
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
  });

  it("drops a malformed entry", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, "not a date");
    expect(readMarketingEntry(true, NOW)).toBe(false);
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
  });

  it("still drops a stale entry when the tab's session key is set", () => {
    window.sessionStorage.setItem(MARKETING_ENTERED_KEY, "1");
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, ago(8 * 24 * 60 * MINUTE));
    expect(readMarketingEntry(true, NOW)).toBe(true);
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
  });

  it("defaults now to the current time", () => {
    writeMarketingEntry(true);
    expect(readMarketingEntry(true)).toBe(true);
  });
});

describe("marketingEntry clear", () => {
  it("removes both stores and notifies subscribers until they unsubscribe", () => {
    writeMarketingEntry(true, NOW);
    const listener = vi.fn();
    const unsubscribe = subscribeMarketingEntry(listener);
    const before = getMarketingEntryVersion();
    clearMarketingEntry();
    expect(window.sessionStorage.getItem(MARKETING_ENTERED_KEY)).toBeNull();
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
    expect(getMarketingEntryVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    clearMarketingEntry();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("marketingEntry with blocked storage", () => {
  it("reads as not entered, and writes and clears without throwing", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    expect(readMarketingEntry(true, NOW)).toBe(false);
    expect(readMarketingEntry(false, NOW)).toBe(false);
    expect(() => writeMarketingEntry(true, NOW)).not.toThrow();
    expect(() => clearMarketingEntry()).not.toThrow();
  });

  it("drops a stale entry even if removing it fails", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, "bad");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readMarketingEntry(true, NOW)).toBe(false);
  });
});
