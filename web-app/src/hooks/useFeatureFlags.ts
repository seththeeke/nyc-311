import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { featureFlagService } from "../services/featureFlagService";
import type { CreateFeatureFlagRequest, FeatureFlag, UpdateFeatureFlagRequest } from "../models/featureFlag";

const FEATURE_FLAGS_QUERY_KEY = ["featureFlags"];

export interface UseFeatureFlagsResult {
  flags: FeatureFlag[] | undefined;
  isLoading: boolean;
  error: Error | null;
  createFlag: (request: CreateFeatureFlagRequest) => Promise<FeatureFlag>;
  updateFlag: (flagKey: string, request: UpdateFeatureFlagRequest) => Promise<FeatureFlag>;
  deleteFlag: (flagKey: string) => Promise<void>;
}

/**
 * Backs `FeatureFlagsPage` (`11-street-condition-implementation.md` §4).
 * Mutations only expose their promises — each editor row tracks its own
 * saving/error state — and every success refreshes the list.
 */
export function useFeatureFlags(): UseFeatureFlagsResult {
  const queryClient = useQueryClient();
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY });
  };

  const { data: flags, isLoading, error } = useQuery<FeatureFlag[], Error>({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: () => featureFlagService.listFeatureFlags(),
  });

  const createMutation = useMutation<FeatureFlag, Error, CreateFeatureFlagRequest>({
    mutationFn: (request) => featureFlagService.createFeatureFlag(request),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation<FeatureFlag, Error, { flagKey: string; request: UpdateFeatureFlagRequest }>({
    mutationFn: ({ flagKey, request }) => featureFlagService.updateFeatureFlag(flagKey, request),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (flagKey) => featureFlagService.deleteFeatureFlag(flagKey),
    onSuccess: invalidate,
  });

  return {
    flags,
    isLoading,
    error: error ?? null,
    createFlag: (request) => createMutation.mutateAsync(request),
    updateFlag: (flagKey, request) => updateMutation.mutateAsync({ flagKey, request }),
    deleteFlag: (flagKey) => deleteMutation.mutateAsync(flagKey),
  };
}
