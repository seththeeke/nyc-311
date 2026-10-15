import { useQuery } from "@tanstack/react-query";
import { featureTreatmentService } from "../services/featureTreatmentService";

/*
 * A flag's treatment, fetched once per page load: never refetched, so a
 * change in the Admin flags page takes effect on the next refresh, not
 * mid-session.
 */
export function useFeatureTreatment(flagKey: string): { treatment: string | null | undefined; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["featureTreatment", flagKey],
    queryFn: () => featureTreatmentService.getTreatment(flagKey),
    staleTime: Infinity,
    retry: false,
  });
  return { treatment: data, isLoading };
}

/** True only once the flag has resolved to `onTreatment`; loading, missing and failed flags all read as off. */
export function useFeatureEnabled(flagKey: string, onTreatment: string): boolean {
  const { treatment } = useFeatureTreatment(flagKey);
  return treatment === onTreatment;
}
