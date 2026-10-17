import { useInfiniteQuery } from "@tanstack/react-query";
import type { ResidentIdea } from "../models/residentIdea";
import { residentService } from "../services/residentService";

export interface ResidentIdeasResult {
  /** Every idea loaded so far, newest first; undefined until the first page arrives. */
  data: ResidentIdea[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** Whether older ideas remain on the server. */
  hasMore: boolean;
  /** Fetches the next, older page. */
  loadMore: () => void;
  isLoadingMore: boolean;
}

/**
 * Ideas newest first — one persona's when `personaId` is set, otherwise
 * everyone's — a page at a time, following the API's cursor
 * (13-customer-simulation.md §2 customer side, decision 9).
 */
export function useResidentIdeas(personaId: string | null): ResidentIdeasResult {
  const query = useInfiniteQuery({
    queryKey: ["residentIdeas", personaId ?? "ALL"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => residentService.listIdeas({ ...(personaId ? { personaId } : {}), ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return {
    data: query.data?.pages.flatMap((page) => page.items),
    isLoading: query.isLoading,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
  };
}
