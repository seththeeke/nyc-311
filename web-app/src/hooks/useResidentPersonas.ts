import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ResidentPersona } from "../models/residentPersona";
import { residentService } from "../services/residentService";

export const RESIDENT_PERSONAS_QUERY_KEY = ["residentPersonas"] as const;

/** Every persona, for the Residents page's secondary workspace. Components call this, never the service (CLAUDE.md §5.1). */
export function useResidentPersonas(): UseQueryResult<ResidentPersona[], Error> {
  return useQuery({
    queryKey: RESIDENT_PERSONAS_QUERY_KEY,
    queryFn: async () => (await residentService.listPersonas()).items,
  });
}
