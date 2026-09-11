import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../../../src/components/pages/LoginPage";
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

function renderLoginRoutes(initialEntry: string | { pathname: string; state?: unknown } = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<p>admin page</p>} />
        <Route path="/monitoring" element={<p>monitoring page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  it("renders the login form when logged out", () => {
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

    renderLoginRoutes();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("calls signIn with the entered credentials on submit", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "password123");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("admin@example.com", "password123"));
  });

  it("does not throw out of handleSubmit when signIn rejects (signInError surfaces it instead)", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error("Invalid email or password"));
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "wrong");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(signIn).toHaveBeenCalled());
  });

  it("shows the sign-in error message when present", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn: vi.fn(),
      signInError: new Error("Invalid email or password"),
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("disables the submit button while signing in", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn: vi.fn(),
      signInError: null,
      isSigningIn: true,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });

  it("redirects to /admin when already logged in, with no redirect target in state", () => {
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

    renderLoginRoutes();

    expect(screen.getByText("admin page")).toBeInTheDocument();
  });

  it("redirects to the originally requested page when logged in with a redirect target in state", () => {
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

    renderLoginRoutes({ pathname: "/login", state: { from: { pathname: "/monitoring" } } });

    expect(screen.getByText("monitoring page")).toBeInTheDocument();
  });

  it("switches to the new-password form when signIn returns NEW_PASSWORD_REQUIRED", async () => {
    const signIn = vi.fn().mockResolvedValue("NEW_PASSWORD_REQUIRED");
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "temp-password");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
  });

  it("shows a mismatch error and does not call completeNewPassword when the two new passwords differ", async () => {
    const signIn = vi.fn().mockResolvedValue("NEW_PASSWORD_REQUIRED");
    const completeNewPassword = vi.fn();
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword,
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "temp-password");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Set a new password" });

    await user2.type(screen.getByLabelText("New password"), "new-password-1");
    await user2.type(screen.getByLabelText("Confirm new password"), "new-password-2");
    await user2.click(screen.getByRole("button", { name: "Set password" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords don't match.");
    expect(completeNewPassword).not.toHaveBeenCalled();
  });

  it("calls completeNewPassword with the new password when both fields match", async () => {
    const signIn = vi.fn().mockResolvedValue("NEW_PASSWORD_REQUIRED");
    const completeNewPassword = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword,
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "temp-password");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Set a new password" });

    await user2.type(screen.getByLabelText("New password"), "new-password-1");
    await user2.type(screen.getByLabelText("Confirm new password"), "new-password-1");
    await user2.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(completeNewPassword).toHaveBeenCalledWith("new-password-1"));
  });

  it("does not throw out of handleNewPasswordSubmit when completeNewPassword rejects", async () => {
    const signIn = vi.fn().mockResolvedValue("NEW_PASSWORD_REQUIRED");
    const completeNewPassword = vi.fn().mockRejectedValue(new Error("Password does not meet policy"));
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword,
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "temp-password");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Set a new password" });

    await user2.type(screen.getByLabelText("New password"), "weak");
    await user2.type(screen.getByLabelText("Confirm new password"), "weak");
    await user2.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(completeNewPassword).toHaveBeenCalled());
  });

  it("shows the completeNewPasswordError message when present", async () => {
    const signIn = vi.fn().mockResolvedValue("NEW_PASSWORD_REQUIRED");
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: new Error("Password does not meet policy"),
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "temp-password");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Set a new password" });

    expect(screen.getByText("Password does not meet policy")).toBeInTheDocument();
  });

  it("disables the set-password button while completing the new password", async () => {
    const signIn = vi.fn().mockResolvedValue("NEW_PASSWORD_REQUIRED");
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: true,
      signOut: vi.fn(),
    });

    renderLoginRoutes();
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText("Email"), "admin@example.com");
    await user2.type(screen.getByLabelText("Password"), "temp-password");
    await user2.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Setting password…" })).toBeDisabled();
  });
});
