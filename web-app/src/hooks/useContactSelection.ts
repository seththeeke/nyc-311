import { useSearchParams } from "react-router-dom";

/* The contact open in the Contacts page's secondary workspace, as `?contact=` so it can be linked. */
export interface ContactSelection {
  contactId: string | null;
  selectContact: (contactId: string | null) => void;
}

export const CONTACT_PARAM = "contact";

export function useContactSelection(): ContactSelection {
  const [params, setParams] = useSearchParams();
  const selectContact = (contactId: string | null): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (contactId) next.set(CONTACT_PARAM, contactId);
      else next.delete(CONTACT_PARAM);
      return next;
    });
  };
  return { contactId: params.get(CONTACT_PARAM), selectContact };
}
