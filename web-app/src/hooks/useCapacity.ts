import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { capacityService } from "../services/capacityService";
import type { CapacityStatus, Operator } from "../models/operator";

const CAPACITY_STATUS_QUERY_KEY = ["capacityStatus"];

/** Keeps the admin-gated Capacity page's live stats reasonably fresh across tabs/admins without manual refresh. */
const REFETCH_INTERVAL_MS = 30_000;

export interface UseCapacityResult {
  status: CapacityStatus | undefined;
  isLoading: boolean;
  error: Error | null;
  addCapacity: (ratePerHour?: number) => Promise<Operator>;
  isAdding: boolean;
  addError: Error | null;
  removeCapacity: (operatorId: string) => Promise<Operator>;
  isRemoving: boolean;
  removeError: Error | null;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * `CapacityManagementPage` (`10-capacity-modeling-and-integration.md`
 * §2.2). Both mutations invalidate the status query on success, so the
 * live stats/roster reflect the change immediately rather than waiting
 * for the next poll.
 */
export function useCapacity(): UseCapacityResult {
  const queryClient = useQueryClient();

  const {
    data: status,
    isLoading,
    error,
  } = useQuery<CapacityStatus, Error>({
    queryKey: CAPACITY_STATUS_QUERY_KEY,
    queryFn: () => capacityService.getCapacityStatus(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const addMutation = useMutation<Operator, Error, number | undefined>({
    mutationFn: (ratePerHour) => capacityService.addCapacity(ratePerHour),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CAPACITY_STATUS_QUERY_KEY });
    },
  });

  const removeMutation = useMutation<Operator, Error, string>({
    mutationFn: (operatorId) => capacityService.removeCapacity(operatorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CAPACITY_STATUS_QUERY_KEY });
    },
  });

  return {
    status,
    isLoading,
    error: error ?? null,
    addCapacity: (ratePerHour) => addMutation.mutateAsync(ratePerHour),
    isAdding: addMutation.isPending,
    addError: addMutation.error,
    removeCapacity: (operatorId) => removeMutation.mutateAsync(operatorId),
    isRemoving: removeMutation.isPending,
    removeError: removeMutation.error,
  };
}
