import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPage } from "../../../src/components/pages/AdminPage";
import { useAuth } from "../../../src/hooks/useAuth";
import type { User } from "../../../src/models/user";

vi.mock("../../../src/hooks/useAuth", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

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

describe("AdminPage", () => {
  it("shows the signed-in admin's email", () => {
    mockedUseAuth.mockReturnValue({
      user,
      isLoading: false,
      signIn: vi.fn(),
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    render(<AdminPage />);

    expect(screen.getByText("Signed in as admin@example.com")).toBeInTheDocument();
  });

  it("calls signOut when the sign-out button is clicked", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user,
      isLoading: false,
      signIn: vi.fn(),
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut,
    });

    render(<AdminPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalled();
  });

  it("omits the signed-in-as line when user is null", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn: vi.fn(),
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    render(<AdminPage />);

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});
