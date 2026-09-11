import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService, type SignInResult } from "../services/authService";
import type { User } from "../models/user";

const CURRENT_USER_QUERY_KEY = ["currentUser"];

export interface UseAuthResult {
  /** `undefined` while the initial session check is still loading, `null` when logged out. */
  user: User | null | undefined;
  isLoading: boolean;
  /** Resolves to the sign-in outcome — LoginPage switches to a new-password form on NEW_PASSWORD_REQUIRED. */
  signIn: (email: string, password: string) => Promise<SignInResult["status"]>;
  signInError: Error | null;
  isSigningIn: boolean;
  /** Completes a NEW_PASSWORD_REQUIRED challenge from signIn. */
  completeNewPassword: (newPassword: string) => Promise<void>;
  completeNewPasswordError: Error | null;
  isCompletingNewPassword: boolean;
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
    onSuccess: (result) => {
      if (result.status === "SIGNED_IN") {
        queryClient.setQueryData(CURRENT_USER_QUERY_KEY, result.user);
      }
    },
  });

  const completeNewPasswordMutation = useMutation({
    mutationFn: (newPassword: string) => authService.completeNewPassword(newPassword),
    onSuccess: (completedUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, completedUser);
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
      const result = await signInMutation.mutateAsync({ email, password });
      return result.status;
    },
    signInError: signInMutation.error,
    isSigningIn: signInMutation.isPending,
    completeNewPassword: async (newPassword: string) => {
      await completeNewPasswordMutation.mutateAsync(newPassword);
    },
    completeNewPasswordError: completeNewPasswordMutation.error,
    isCompletingNewPassword: completeNewPasswordMutation.isPending,
    signOut: async () => {
      await signOutMutation.mutateAsync();
    },
  };
}
