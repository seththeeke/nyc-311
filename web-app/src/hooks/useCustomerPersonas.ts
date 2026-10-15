import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CustomerPersona } from "../models/customerPersona";
import { customerService } from "../services/customerService";

export const CUSTOMER_PERSONAS_QUERY_KEY = ["customerPersonas"] as const;

/** Every persona, for the Customers page's secondary workspace. Components call this, never the service (CLAUDE.md §5.1). */
export function useCustomerPersonas(): UseQueryResult<CustomerPersona[], Error> {
  return useQuery({
    queryKey: CUSTOMER_PERSONAS_QUERY_KEY,
    queryFn: async () => (await customerService.listPersonas()).items,
  });
}
