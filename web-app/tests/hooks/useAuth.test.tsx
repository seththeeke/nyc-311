import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "../../src/hooks/useAuth";
import { authService } from "../../src/services/authService";
import type { User } from "../../src/models/user";

vi.mock("../../src/services/authService", () => ({
  authService: { signIn: vi.fn(), completeNewPassword: vi.fn(), signOut: vi.fn(), getCurrentUser: vi.fn() },
}));

const mockedSignIn = vi.mocked(authService.signIn);
const mockedCompleteNewPassword = vi.mocked(authService.completeNewPassword);
const mockedSignOut = vi.mocked(authService.signOut);
const mockedGetCurrentUser = vi.mocked(authService.getCurrentUser);

const user: User = {
  user_id: "01ADMIN",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedSignIn.mockReset();
  mockedCompleteNewPassword.mockReset();
  mockedSignOut.mockReset();
  mockedGetCurrentUser.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAuth", () => {
  it("starts loading, then resolves to the current session's user", async () => {
    mockedGetCurrentUser.mockResolvedValue(user);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual(user);
  });

  it("resolves to null when logged out", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("signIn calls the service and updates user when the outcome is SIGNED_IN", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedSignIn.mockResolvedValue({ status: "SIGNED_IN", user });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signIn("admin@example.com", "password123");
    });

    expect(mockedSignIn).toHaveBeenCalledWith("admin@example.com", "password123");
    expect(outcome).toBe("SIGNED_IN");
    await waitFor(() => expect(result.current.user).toEqual(user));
  });

  it("signIn returns NEW_PASSWORD_REQUIRED without updating user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedSignIn.mockResolvedValue({ status: "NEW_PASSWORD_REQUIRED" });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signIn("admin@example.com", "temp-password");
    });

    expect(outcome).toBe("NEW_PASSWORD_REQUIRED");
    expect(result.current.user).toBeNull();
  });

  it("surfaces a signIn failure via signInError, without updating user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedSignIn.mockRejectedValue(new Error("Invalid email or password"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.signIn("admin@example.com", "wrong")).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.signInError?.message).toBe("Invalid email or password"));
    expect(result.current.user).toBeNull();
  });

  it("completeNewPassword calls the service and updates user on success", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedCompleteNewPassword.mockResolvedValue(user);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeNewPassword("new-password-123");
    });

    expect(mockedCompleteNewPassword).toHaveBeenCalledWith("new-password-123");
    await waitFor(() => expect(result.current.user).toEqual(user));
  });

  it("surfaces a completeNewPassword failure via completeNewPasswordError", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedCompleteNewPassword.mockRejectedValue(new Error("Password does not meet policy"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.completeNewPassword("weak")).rejects.toThrow();
    });

    await waitFor(() =>
      expect(result.current.completeNewPasswordError?.message).toBe("Password does not meet policy")
    );
  });

  it("signOut calls the service and clears the user", async () => {
    mockedGetCurrentUser.mockResolvedValue(user);
    mockedSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockedSignOut).toHaveBeenCalled();
    await waitFor(() => expect(result.current.user).toBeNull());
  });
});
