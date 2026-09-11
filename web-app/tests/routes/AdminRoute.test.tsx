import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminRoute } from "../../src/routes/AdminRoute";
import { useAuth } from "../../src/hooks/useAuth";
import type { User } from "../../src/models/user";

vi.mock("../../src/hooks/useAuth", () => ({ useAuth: vi.fn() }));

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

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <p>admin content</p>
            </AdminRoute>
          }
        />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminRoute", () => {
  it("renders nothing while the session check is loading", () => {
    mockedUseAuth.mockReturnValue({
      user: undefined,
      isLoading: true,
      signIn: vi.fn(),
      signInError: null,
      isSigningIn: false,
      completeNewPassword: vi.fn(),
      completeNewPasswordError: null,
      isCompletingNewPassword: false,
      signOut: vi.fn(),
    });

    const { container } = renderProtected();

    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to /login when logged out", () => {
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

    renderProtected();

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders its children when logged in", () => {
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

    renderProtected();

    expect(screen.getByText("admin content")).toBeInTheDocument();
  });
});
