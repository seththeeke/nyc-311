import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CustomerIdea } from "../models/customerIdea";
import { customerService } from "../services/customerService";

/** One idea, for the Idea Detail view. Components call this, never the service (CLAUDE.md §5.1). */
export function useCustomerIdea(personaId: string, ideaId: string): UseQueryResult<CustomerIdea, Error> {
  return useQuery({
    queryKey: ["customerIdea", personaId, ideaId],
    queryFn: () => customerService.getIdea(personaId, ideaId),
  });
}
