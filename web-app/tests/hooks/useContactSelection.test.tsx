import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CONTACTS_QUERY_KEY } from "../../src/hooks/useContacts";
import { useCachedContact } from "../../src/hooks/useCachedContact";
import { useContactSelection } from "../../src/hooks/useContactSelection";
import { MOCK_CONTACTS } from "../../src/test-data/contacts";

function routerAt(path: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}

describe("useContactSelection", () => {
  it("reads and writes ?contact=, keeping other params", () => {
    const { result } = renderHook(() => ({ selection: useContactSelection(), search: useLocation().search }), { wrapper: routerAt("/contacts?x=1") });
    expect(result.current.selection.contactId).toBeNull();
    act(() => result.current.selection.selectContact("01C"));
    expect(result.current.selection.contactId).toBe("01C");
    expect(result.current.search).toBe("?x=1&contact=01C");
    act(() => result.current.selection.selectContact(null));
    expect(result.current.selection.contactId).toBeNull();
    expect(result.current.search).toBe("?x=1");
  });
});

describe("useCachedContact", () => {
  it("finds a contact in any loaded list page, and follows the cache as pages arrive", () => {
    const client = new QueryClient();
    client.setQueryData([...CONTACTS_QUERY_KEY, "FEATURE_REQUEST", null, "NEWEST"], { pages: [{ contacts: [MOCK_CONTACTS[0]], next_cursor: "1" }], pageParams: [null] });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useCachedContact(id), { wrapper, initialProps: { id: MOCK_CONTACTS[0].contact_id as string | null } });
    expect(result.current).toBe(MOCK_CONTACTS[0]);
    rerender({ id: null });
    expect(result.current).toBeNull();
    rerender({ id: MOCK_CONTACTS[2].contact_id });
    expect(result.current).toBeNull();
    act(() => {
      client.setQueryData([...CONTACTS_QUERY_KEY, "FEATURE_REQUEST", "CLOSED", "NEWEST"], { pages: [{ contacts: [MOCK_CONTACTS[2]], next_cursor: null }], pageParams: [null] });
    });
    expect(result.current).toBe(MOCK_CONTACTS[2]);
  });
});
