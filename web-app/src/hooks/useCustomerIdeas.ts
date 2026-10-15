import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CustomerIdea } from "../models/customerIdea";
import { customerService } from "../services/customerService";

/** Ideas newest first — one persona's when `personaId` is set, otherwise everyone's. */
export function useCustomerIdeas(personaId: string | null): UseQueryResult<CustomerIdea[], Error> {
  return useQuery({
    queryKey: ["customerIdeas", personaId ?? "ALL"],
    queryFn: async () => (await customerService.listIdeas(personaId ? { personaId } : {})).items,
  });
}
