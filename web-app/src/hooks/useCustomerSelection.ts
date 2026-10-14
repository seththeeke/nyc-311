import { useSearchParams } from "react-router-dom";
import { IDEA_TYPES, type IdeaType } from "../models/customerIdea";

/*
 * What the Customers page is focused on, kept in the URL so both
 * workspaces read the same state and any view can be linked to:
 * `?persona=` (a persona), `?order=` (one order's ideas), `?type=` (one
 * idea type), `?idea=` (the expanded idea).
 */
export interface CustomerSelection {
  personaId: string | null;
  orderId: string | null;
  ideaType: IdeaType | null;
  ideaId: string | null;
  selectPersona: (personaId: string | null) => void;
  selectOrder: (orderId: string | null) => void;
  selectIdeaType: (ideaType: IdeaType | null) => void;
  toggleIdea: (ideaId: string) => void;
  clearAll: () => void;
}

type SelectionKey = "persona" | "order" | "type" | "idea";

function asIdeaType(value: string | null): IdeaType | null {
  return IDEA_TYPES.find((type) => type === value) ?? null;
}

export function useCustomerSelection(): CustomerSelection {
  const [params, setParams] = useSearchParams();
  const ideaId = params.get("idea");

  const update = (changes: Partial<Record<SelectionKey, string | null>>): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };

  return {
    personaId: params.get("persona"),
    orderId: params.get("order"),
    ideaType: asIdeaType(params.get("type")),
    ideaId,
    /* Picking a persona starts a fresh view of them: any order filter or open idea is dropped. */
    selectPersona: (personaId) => update({ persona: personaId, order: null, idea: null }),
    selectOrder: (orderId) => update({ order: orderId, idea: null }),
    selectIdeaType: (ideaType) => update({ type: ideaType }),
    toggleIdea: (id) => update({ idea: ideaId === id ? null : id }),
    clearAll: () => update({ persona: null, order: null, type: null, idea: null }),
  };
}
