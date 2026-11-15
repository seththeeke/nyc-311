import { useState, useSyncExternalStore } from "react";
import {
  getMarketingEntryVersion,
  readMarketingEntry,
  subscribeMarketingEntry,
  writeMarketingEntry,
} from "../routes/marketingEntry";

interface EntryState {
  version: number;
  sticky: boolean;
  entered: boolean;
}

/*
 * Whether the visitor has entered the fleet, re-read when `sticky` changes
 * (the flag resolves after mount) or the entry is cleared (the About drawer's
 * "Back to the intro"), so the gate shows the marketing page again at once.
 */
export function useMarketingEntry(sticky: boolean): { entered: boolean; enter: () => void } {
  const version = useSyncExternalStore(subscribeMarketingEntry, getMarketingEntryVersion);
  const [state, setState] = useState<EntryState>(() => ({ version, sticky, entered: readMarketingEntry(sticky) }));
  let current = state;
  if (state.version !== version || state.sticky !== sticky) {
    current = { version, sticky, entered: readMarketingEntry(sticky) };
    setState(current);
  }
  const enter = (): void => {
    writeMarketingEntry(sticky);
    setState({ version, sticky, entered: true });
  };
  return { entered: current.entered, enter };
}
