import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ResidentIdeaDetail } from "../models/residentIdea";
import { residentService } from "../services/residentService";

/** One idea with its workstream, for the Idea Detail view. Components call this, never the service (CLAUDE.md §5.1). */
export function useResidentIdea(personaId: string, ideaId: string): UseQueryResult<ResidentIdeaDetail, Error> {
  return useQuery({
    queryKey: ["residentIdea", personaId, ideaId],
    queryFn: () => residentService.getIdea(personaId, ideaId),
  });
}
