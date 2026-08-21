import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { orderService, type ListOrdersParams } from "../services/orderService";
import type { OrderListResponse } from "../models/order";

/*
 * Orders are created continuously as Requests get promoted
 * (3-order-ingestion.md), so a 60s refetch interval — matching
 * usePollerMetrics.ts — is enough for an open dashboard tab to eventually
 * pick up new Orders without a manual refresh.
 */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useOrders(params: ListOrdersParams): UseQueryResult<OrderListResponse, Error> {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => orderService.listOrders(params),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
