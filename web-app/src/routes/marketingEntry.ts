/*
 * Remembers that a visitor clicked Enter fleet on the marketing page
 * (docs/18-marketing-page.md, #165). On MARKETING_STICKY_ENTRY C it's the
 * per-tab sessionStorage key only; on T1 it's also a localStorage timestamp,
 * refreshed on each read while valid and dropped once more than 7 days old.
 * Storage errors are swallowed: blocked storage means "not remembered".
 */

/** Per-tab key, honored under every treatment so a visitor mid-session is never bounced. */
export const MARKETING_ENTERED_KEY = "nyc311.marketing.entered";

/** Persisted key (T1 only): the ISO time the entry was last seen. */
export const MARKETING_ENTERED_AT_KEY = "nyc311.marketing.enteredAt";

/** An entry older than this (strictly) is stale. */
export const MARKETING_ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let version = 0;
const listeners = new Set<() => void>();

function readSession(): boolean {
  try {
    return window.sessionStorage.getItem(MARKETING_ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}

function removeStored(): void {
  try {
    window.localStorage.removeItem(MARKETING_ENTERED_AT_KEY);
  } catch {
    /* Storage blocked: nothing was stored. */
  }
}

function writeStored(now: Date): void {
  try {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, now.toISOString());
  } catch {
    /* Storage blocked: entering still works for this render, it just isn't remembered. */
  }
}

/** True if the persisted entry is valid at `now`; refreshes it if so, removes it if stale or malformed. */
function readStored(now: Date): boolean {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MARKETING_ENTERED_AT_KEY);
  } catch {
    return false;
  }
  if (raw === null) return false;
  const enteredAt = Date.parse(raw);
  if (Number.isNaN(enteredAt) || now.getTime() - enteredAt > MARKETING_ENTRY_TTL_MS) {
    removeStored();
    return false;
  }
  writeStored(now);
  return true;
}

/** Whether the visitor has entered: the tab's session key, plus (when `sticky`) the persisted entry. */
export function readMarketingEntry(sticky: boolean, now: Date = new Date()): boolean {
  if (!sticky) return readSession();
  /* Read the stored entry even when the session key is set, so a valid one is refreshed or a stale one dropped. */
  const stored = readStored(now);
  return readSession() || stored;
}

/** Records the entry: the tab's session key, plus (when `sticky`) the persisted timestamp. */
export function writeMarketingEntry(sticky: boolean, now: Date = new Date()): void {
  try {
    window.sessionStorage.setItem(MARKETING_ENTERED_KEY, "1");
  } catch {
    /* Storage blocked: entering still works for this render, it just isn't remembered. */
  }
  if (sticky) writeStored(now);
}

/** Forgets the entry in both stores and tells every mounted gate to re-read it. */
export function clearMarketingEntry(): void {
  try {
    window.sessionStorage.removeItem(MARKETING_ENTERED_KEY);
  } catch {
    /* Storage blocked: nothing was stored. */
  }
  removeStored();
  version += 1;
  listeners.forEach((listener) => listener());
}

/** useSyncExternalStore subscription: fires when the entry is cleared. */
export function subscribeMarketingEntry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** useSyncExternalStore snapshot: bumps on every clear. */
export function getMarketingEntryVersion(): number {
  return version;
}
