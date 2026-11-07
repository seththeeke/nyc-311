import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { Contact, ContactPage } from "../models/contact";
import { CONTACTS_QUERY_KEY } from "./useContacts";

/**
 * One contact, found in the pages the Contacts list has already loaded:
 * the API has no get-one route, and the panel only opens on a listed row.
 * Re-reads whenever the cache changes; `null` until that contact is loaded.
 */
export function useCachedContact(contactId: string | null): Contact | null {
  const client = useQueryClient();
  const subscribe = useCallback((onChange: () => void) => client.getQueryCache().subscribe(onChange), [client]);
  const find = (): Contact | null => {
    if (!contactId) return null;
    for (const [, data] of client.getQueriesData<InfiniteData<ContactPage>>({ queryKey: CONTACTS_QUERY_KEY })) {
      const match = data?.pages.flatMap((page) => page.contacts).find((contact) => contact.contact_id === contactId);
      if (match) return match;
    }
    return null;
  };
  return useSyncExternalStore(subscribe, find, find);
}
