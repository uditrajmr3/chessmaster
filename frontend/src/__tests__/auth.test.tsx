/**
 * Tests for AuthProvider (lib/auth.tsx) and AuthGuard (components/AuthGuard.tsx).
 *
 * Jest hoists all jest.mock() calls, so module-level mocks apply to every test.
 * Strategy:
 *  - Mock next/navigation for all tests (always needed).
 *  - Mock @/lib/api for all tests (AuthProvider calls api.getMe/login/logout).
 *  - AuthProvider tests use the REAL useAuth from @/lib/auth but
 *    control behaviour by controlling the mocked api functions.
 *  - AuthGuard tests mock useAuth via jest.spyOn so they can control
 *    the returned value per-test without affecting AuthProvider tests.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock next/navigation ──────────────────────────────────────────────────────

const mockReplace = jest.fn();
let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

// ── Mock @/lib/api ────────────────────────────────────────────────────────────

const mockGetMe = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockRequestVerify = jest.fn();

jest.mock("@/lib/api", () => ({
  AuthError: class AuthError extends Error {
    constructor(msg = "Unauthorized") {
      super(msg);
      this.name = "AuthError";
    }
  },
  api: {
    getMe: (...args: unknown[]) => mockGetMe(...args),
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    requestVerify: (...args: unknown[]) => mockRequestVerify(...args),
  },
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const verifiedUser = {
  id: "u1",
  email: "user@example.com",
  is_verified: true,
  is_active: true,
  lichess_username: null,
  chesscom_username: null,
};

const unverifiedUser = { ...verifiedUser, is_verified: false };

// =============================================================================
// AuthProvider tests  (real useAuth, mocked api)
// =============================================================================

import { AuthProvider, useAuth } from "@/lib/auth";

function AuthConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>No user</div>;
  return <div>User: {user.email}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/dashboard";
  });

  it("calls getMe on mount and exposes user when it resolves", async () => {
    mockGetMe.mockResolvedValueOnce(verifiedUser);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("User: user@example.com")).toBeInTheDocument();
    });
  });

  it("sets user to null when getMe rejects with AuthError", async () => {
    const { AuthError } = jest.requireMock("@/lib/api");
    mockGetMe.mockRejectedValueOnce(new AuthError());

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No user")).toBeInTheDocument();
    });
  });

  it("sets user to null when getMe rejects with a generic error", async () => {
    mockGetMe.mockRejectedValueOnce(new Error("Network error"));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No user")).toBeInTheDocument();
    });
  });

  it("login calls api.login then re-fetches user", async () => {
    mockGetMe.mockRejectedValueOnce(new Error("not authed"));
    mockGetMe.mockResolvedValueOnce(verifiedUser);
    mockLogin.mockResolvedValueOnce(verifiedUser);

    function LoginTrigger() {
      const { user, login, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      if (!user)
        return (
          <button onClick={() => login("user@example.com", "pass")}>
            Login
          </button>
        );
      return <div>User: {user.email}</div>;
    }

    render(
      <AuthProvider>
        <LoginTrigger />
      </AuthProvider>
    );

    await waitFor(() => screen.getByText("Login"));
    await act(async () => {
      screen.getByText("Login").click();
    });

    await waitFor(() => {
      expect(screen.getByText("User: user@example.com")).toBeInTheDocument();
    });
    expect(mockLogin).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "pass",
    });
  });

  it("logout clears user", async () => {
    mockGetMe.mockResolvedValueOnce(verifiedUser);
    mockLogout.mockResolvedValueOnce(undefined);

    function LogoutTrigger() {
      const { user, logout, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      if (!user) return <div>No user</div>;
      return <button onClick={logout}>Logout</button>;
    }

    render(
      <AuthProvider>
        <LogoutTrigger />
      </AuthProvider>
    );

    await waitFor(() => screen.getByText("Logout"));
    await act(async () => {
      screen.getByText("Logout").click();
    });

    await waitFor(() => {
      expect(screen.getByText("No user")).toBeInTheDocument();
    });
  });
});

// =============================================================================
// AuthGuard tests  (useAuth is spied on per-test)
// =============================================================================

import * as authModule from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";

type AuthContextValue = ReturnType<typeof useAuth>;

function setUseAuth(val: Partial<AuthContextValue>) {
  jest.spyOn(authModule, "useAuth").mockReturnValue({
    user: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    ...val,
  } as AuthContextValue);
}

describe("AuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/dashboard";
    jest.restoreAllMocks();
  });

  it("redirects to /login and renders nothing when user is null on a protected route", async () => {
    mockPathname = "/dashboard";
    setUseAuth({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Dashboard content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });

  it("renders verify notice (not children) when user is unverified", () => {
    mockPathname = "/dashboard";
    setUseAuth({ user: unverifiedUser, loading: false });

    render(
      <AuthGuard>
        <div>Dashboard content</div>
      </AuthGuard>
    );

    expect(screen.getByRole("heading", { name: /verify your email/i })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });

  it("renders children when user is verified", () => {
    mockPathname = "/dashboard";
    setUseAuth({ user: verifiedUser, loading: false });

    render(
      <AuthGuard>
        <div>Dashboard content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders loading state and does not redirect while loading", () => {
    mockPathname = "/dashboard";
    setUseAuth({ user: null, loading: true });

    render(
      <AuthGuard>
        <div>Dashboard content</div>
      </AuthGuard>
    );

    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children on public route /login even when user is null", () => {
    mockPathname = "/login";
    setUseAuth({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Login page</div>
      </AuthGuard>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children on public route /register even when user is null", () => {
    mockPathname = "/register";
    setUseAuth({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Register page</div>
      </AuthGuard>
    );

    expect(screen.getByText("Register page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children on public route /forgot-password even when user is null", () => {
    mockPathname = "/forgot-password";
    setUseAuth({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Forgot password page</div>
      </AuthGuard>
    );

    expect(screen.getByText("Forgot password page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children on public route /reset-password even when user is null", () => {
    mockPathname = "/reset-password";
    setUseAuth({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Reset password page</div>
      </AuthGuard>
    );

    expect(screen.getByText("Reset password page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children on public route /verify-email even when user is null", () => {
    mockPathname = "/verify-email";
    setUseAuth({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Verify email page</div>
      </AuthGuard>
    );

    expect(screen.getByText("Verify email page")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("calls api.requestVerify when resend button is clicked for unverified user", async () => {
    mockPathname = "/dashboard";
    setUseAuth({ user: unverifiedUser, loading: false });
    mockRequestVerify.mockResolvedValueOnce(undefined);

    render(
      <AuthGuard>
        <div>Dashboard content</div>
      </AuthGuard>
    );

    const resendButton = screen.getByRole("button", {
      name: /resend verification email/i,
    });
    await act(async () => {
      resendButton.click();
    });

    expect(mockRequestVerify).toHaveBeenCalledWith(unverifiedUser.email);
  });
});
