import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import type { ContactPage, ContactQuery } from "../models/contact";
import { contactService } from "../services/contactService";

export const CONTACTS_QUERY_KEY = ["contacts"] as const;

/** Contacts for the filters, a page at a time; `fetchNextPage` loads the next. */
export function useContacts(query: ContactQuery): UseInfiniteQueryResult<InfiniteData<ContactPage, string | null>, Error> {
  return useInfiniteQuery({
    queryKey: [...CONTACTS_QUERY_KEY, query.type, query.status, query.order],
    queryFn: ({ pageParam }) => contactService.listContacts(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
}
