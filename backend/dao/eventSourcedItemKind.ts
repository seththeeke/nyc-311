import { EVENT_SORT_KEY_PREFIX, PROJECTION_SORT_KEY } from "./dao";

export type EventSourcedItemKind = "EVENT" | "PROJECTION";

/**
 * Classifies an event-sourced table item (Orders, Cases, Operators) by its
 * `sk`: the `#METADATA` projection row, an `EVENT#<n>` event row, or
 * neither. The one place outside `EventSourcedDao` that reads this layout,
 * so the stream fan-outs and the warehouse rebuild can't drift apart.
 */
export function eventSourcedItemKind(sk: unknown): EventSourcedItemKind | null {
  if (sk === PROJECTION_SORT_KEY) return "PROJECTION";
  if (typeof sk === "string" && sk.startsWith(EVENT_SORT_KEY_PREFIX)) return "EVENT";
  return null;
}
