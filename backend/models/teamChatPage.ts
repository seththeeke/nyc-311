/* A page of messages or inbox entries, with the id to pass as `before` (or `after`) for the next page; null at the end. */
export interface TeamChatPage<TItem> {
  items: TItem[];
  next_cursor: string | null;
}
