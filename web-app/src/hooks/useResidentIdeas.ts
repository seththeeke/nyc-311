import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ResidentIdea } from "../models/residentIdea";
import { residentService } from "../services/residentService";

/** Ideas newest first — one persona's when `personaId` is set, otherwise everyone's. */
export function useResidentIdeas(personaId: string | null): UseQueryResult<ResidentIdea[], Error> {
  return useQuery({
    queryKey: ["residentIdeas", personaId ?? "ALL"],
    queryFn: async () => (await residentService.listIdeas(personaId ? { personaId } : {})).items,
  });
}
