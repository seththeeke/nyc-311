import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ResidentIdea } from "../models/residentIdea";
import { residentService } from "../services/residentService";

/** One idea, for the Idea Detail view. Components call this, never the service (CLAUDE.md §5.1). */
export function useResidentIdea(personaId: string, ideaId: string): UseQueryResult<ResidentIdea, Error> {
  return useQuery({
    queryKey: ["residentIdea", personaId, ideaId],
    queryFn: () => residentService.getIdea(personaId, ideaId),
  });
}
