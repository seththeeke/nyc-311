import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "../state/auth";

export const useLocations = () => useQuery({ queryKey: ["locations"], queryFn: api.locations });
export const useOrders = () => useQuery({ queryKey: ["orders"], queryFn: api.orders, refetchInterval: 4000 });
export const useOrder = (id: string) => useQuery({ queryKey: ["order", id], queryFn: () => api.order(id), enabled: !!id });
export const useCases = () => useQuery({ queryKey: ["cases"], queryFn: api.cases, refetchInterval: 4000 });
export const useCase = (id: string) => useQuery({ queryKey: ["case", id], queryFn: () => api.case(id), enabled: !!id });
export const useOperators = () => useQuery({ queryKey: ["operators"], queryFn: api.operators, refetchInterval: 2000 });
export const useTracking = () => useQuery({ queryKey: ["tracking"], queryFn: api.tracking, refetchInterval: 2000 });
export const useShifts = () => useQuery({ queryKey: ["shifts"], queryFn: api.shifts, refetchInterval: 10000 });
export const useMetrics = () => useQuery({ queryKey: ["metrics"], queryFn: api.metrics, refetchInterval: 5000 });

export function useResolveCase() {
  const qc = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (vars: { id: string; note?: string }) => api.resolveCase(vars.id, token!, vars.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}

export function useAssignCase() {
  const qc = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (id: string) => api.assignCase(id, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }),
  });
}

export function useCloseCase() {
  const qc = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (id: string) => api.closeCase(id, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}
