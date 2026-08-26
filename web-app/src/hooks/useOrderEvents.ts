import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { orderEventService, type ListOrderEventsParams } from "../services/orderEventService";
import type { OrderEventListResponse } from "../models/order";

/* Same 60s cadence as useOrders.ts — new OrderEvents arrive continuously as the evaluation pipeline runs. */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useOrderEvents(params: ListOrderEventsParams): UseQueryResult<OrderEventListResponse, Error> {
  return useQuery({
    queryKey: ["orderEvents", params],
    queryFn: () => orderEventService.listOrderEvents(params),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
