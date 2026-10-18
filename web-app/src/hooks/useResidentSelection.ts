import { useSearchParams } from "react-router-dom";
import { IDEA_TYPES, type IdeaType } from "../models/residentIdea";

/*
 * What the Residents feed is focused on, kept in the URL so both
 * workspaces read the same state and any view can be linked to:
 * `?persona=` (a resident), `?order=` (one order's ideas) and `?type=`
 * (one idea type). An idea's own detail view is a route of its own.
 */
export interface ResidentSelection {
  personaId: string | null;
  orderId: string | null;
  ideaType: IdeaType | null;
  selectPersona: (personaId: string | null) => void;
  selectOrder: (orderId: string | null) => void;
  selectIdeaType: (ideaType: IdeaType | null) => void;
  clearAll: () => void;
}

type SelectionKey = "persona" | "order" | "type";

function asIdeaType(value: string | null): IdeaType | null {
  return IDEA_TYPES.find((type) => type === value) ?? null;
}

export function useResidentSelection(): ResidentSelection {
  const [params, setParams] = useSearchParams();

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
    /* Picking a resident starts a fresh view of them: any order filter is dropped. */
    selectPersona: (personaId) => update({ persona: personaId, order: null }),
    selectOrder: (orderId) => update({ order: orderId }),
    selectIdeaType: (ideaType) => update({ type: ideaType }),
    clearAll: () => update({ persona: null, order: null, type: null }),
  };
}
