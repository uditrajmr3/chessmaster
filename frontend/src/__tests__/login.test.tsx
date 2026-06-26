/**
 * Tests for login page and register page.
 *
 * Mocking strategy:
 * - next/navigation: mocked at module level; useRouter returns { push: mockPush }
 * - @/lib/auth: mocked at module level; useAuth returns { login: mockLogin }
 * - @/lib/api: mocked at module level; api.register is mockRegister
 * - next/link: re-exported as a plain <a> anchor so href assertions work
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Shared mock handles ────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockLogin = jest.fn();
const mockRegister = jest.fn();

// ── next/navigation mock ──────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── next/link mock ────────────────────────────────────────────────────────────

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── @/lib/auth mock ───────────────────────────────────────────────────────────

class AuthError extends Error {
  constructor(msg = "Unauthorized") {
    super(msg);
    this.name = "AuthError";
  }
}

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ login: mockLogin }),
  AuthError,
}));

// ── @/lib/api mock ────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  api: {
    register: (...args: unknown[]) => mockRegister(...args),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
    requestVerify: jest.fn(),
  },
  AuthError,
}));

// ── Import pages after mocks are set up ──────────────────────────────────────

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage tests
// ─────────────────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders email field, password field, and submit button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls login with correct email and password, then redirects to /", async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });

    expect(mockLogin).toHaveBeenCalledWith("user@example.com", "supersecret");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows 'Invalid email or password' when login rejects with AuthError", async () => {
    mockLogin.mockRejectedValueOnce(new AuthError("Unauthorized"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "badpassword" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid email or password"
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RegisterPage tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls api.register with email and password on submit, then shows success message", async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "strongpass1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "strongpass1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });

    expect(mockRegister).toHaveBeenCalledWith({
      email: "newuser@example.com",
      password: "strongpass1",
    });

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("shows duplicate-account error when api.register rejects with 'already exists'", async () => {
    mockRegister.mockRejectedValueOnce(new Error("user already exists"));

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "strongpass1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "strongpass1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An account with that email already exists"
      );
    });
  });

  it("shows validation error when passwords do not match", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "strongpass1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "differentpass" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Passwords do not match"
      );
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });
});
