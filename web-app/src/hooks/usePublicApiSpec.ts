import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { publicApiSpecService } from "../services/publicApiSpecService";

export const PUBLIC_API_SPEC_QUERY_KEY = ["publicApiSpec"] as const;

/** The public API's spec text; it only changes on deploy, so it's never refetched in the background. */
export function usePublicApiSpec(): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: PUBLIC_API_SPEC_QUERY_KEY,
    queryFn: () => publicApiSpecService.getSpecYaml(),
    staleTime: Infinity,
  });
}
