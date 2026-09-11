import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import type { User } from "../models/user";

const CURRENT_USER_QUERY_KEY = ["currentUser"];

export interface UseAuthResult {
  /** `undefined` while the initial session check is still loading, `null` when logged out. */
  user: User | null | undefined;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInError: Error | null;
  isSigningIn: boolean;
  signOut: () => Promise<void>;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * `AdminRoute` and `LoginPage` (`9-admin-auth-integration.md` §3). Session
 * state is held in TanStack Query's cache (`CURRENT_USER_QUERY_KEY`) rather
 * than component state, so every consumer of `useAuth` sees the same
 * logged-in/out state without prop drilling.
 */
export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => authService.getCurrentUser(),
    staleTime: Infinity,
  });

  const signInMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) => authService.signIn(input.email, input.password),
    onSuccess: (signedInUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, signedInUser);
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => authService.signOut(),
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
    },
  });

  return {
    user,
    isLoading,
    signIn: async (email: string, password: string) => {
      await signInMutation.mutateAsync({ email, password });
    },
    signInError: signInMutation.error,
    isSigningIn: signInMutation.isPending,
    signOut: async () => {
      await signOutMutation.mutateAsync();
    },
  };
}
