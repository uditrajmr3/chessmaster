/**
 * Tests for the Settings page (app/settings/page.tsx) and Sidebar logout behaviour.
 *
 * Mocking strategy:
 * - @/lib/auth: mocked module-level; useAuth returns configurable values
 * - @/lib/api: mocked module-level; api.updateMe is a jest mock
 * - next/navigation: mocked for useRouter / usePathname
 * - next/link: rendered as plain <a> tags
 * - lucide-react: passthrough (lightweight SVGs, no side-effects)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Shared mock handles ────────────────────────────────────────────────────────

const mockUpdateMe = jest.fn();
const mockRefresh = jest.fn();
const mockLogout = jest.fn();
const mockPush = jest.fn();

// ── next/navigation mock ──────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/settings",
}));

// ── next/link mock ────────────────────────────────────────────────────────────

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── @/lib/api mock ────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000/api",
  api: {
    updateMe: (...args: unknown[]) => mockUpdateMe(...args),
    startSync: jest.fn(),
  },
}));

// ── @/lib/analyze mock ────────────────────────────────────────────────────────

jest.mock("@/lib/analyze", () => ({
  runAnalysis: jest.fn(),
}));

// ── @/lib/useDataRefresh mock ─────────────────────────────────────────────────

jest.mock("@/lib/useDataRefresh", () => ({
  emitDataRefresh: jest.fn(),
}));

// ── @/lib/auth mock ───────────────────────────────────────────────────────────

const defaultUser = {
  id: "u1",
  email: "player@example.com",
  is_verified: true,
  is_active: true,
  lichess_username: "Magnus",
  chesscom_username: "Hikaru",
};

let mockUser: typeof defaultUser | null = defaultUser;

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: jest.fn(),
    logout: mockLogout,
    refresh: mockRefresh,
  }),
}));

// ── Import pages after mocks ──────────────────────────────────────────────────

import SettingsPage from "@/app/settings/page";
import Sidebar from "@/components/Sidebar";

// =============================================================================
// SettingsPage tests
// =============================================================================

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { ...defaultUser };
  });

  it("renders the user email (read-only)", () => {
    render(<SettingsPage />);
    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveValue("player@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("pre-fills Lichess and Chess.com usernames from auth user", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText(/lichess username/i)).toHaveValue("Magnus");
    expect(screen.getByLabelText(/chess\.com username/i)).toHaveValue("Hikaru");
  });

  it("pre-fills empty strings when usernames are null", () => {
    mockUser = { ...defaultUser, lichess_username: null, chesscom_username: null };
    render(<SettingsPage />);
    expect(screen.getByLabelText(/lichess username/i)).toHaveValue("");
    expect(screen.getByLabelText(/chess\.com username/i)).toHaveValue("");
  });

  it("calls api.updateMe with new Lichess value and shows confirmation on success", async () => {
    mockUpdateMe.mockResolvedValueOnce({ ...defaultUser, lichess_username: "DrNykterstein" });
    mockRefresh.mockResolvedValueOnce(undefined);

    render(<SettingsPage />);

    // Change lichess username
    fireEvent.change(screen.getByLabelText(/lichess username/i), {
      target: { value: "DrNykterstein" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    });

    expect(mockUpdateMe).toHaveBeenCalledWith({
      lichess_username: "DrNykterstein",
      chesscom_username: "Hikaru",
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/saved successfully/i);
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("calls api.updateMe with new Chess.com value on success", async () => {
    mockUpdateMe.mockResolvedValueOnce({ ...defaultUser, chesscom_username: "GrandmasterBot" });
    mockRefresh.mockResolvedValueOnce(undefined);

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText(/chess\.com username/i), {
      target: { value: "GrandmasterBot" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    });

    expect(mockUpdateMe).toHaveBeenCalledWith({
      lichess_username: "Magnus",
      chesscom_username: "GrandmasterBot",
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/saved successfully/i);
    });
  });

  it("sends empty string when a username is cleared", async () => {
    mockUpdateMe.mockResolvedValueOnce({ ...defaultUser, lichess_username: null });
    mockRefresh.mockResolvedValueOnce(undefined);

    render(<SettingsPage />);

    // Clear the lichess field
    fireEvent.change(screen.getByLabelText(/lichess username/i), {
      target: { value: "" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    });

    expect(mockUpdateMe).toHaveBeenCalledWith({
      lichess_username: "",
      chesscom_username: "Hikaru",
    });
  });

  it("disables Save button while submitting", async () => {
    // Never resolves during test
    mockUpdateMe.mockReturnValueOnce(new Promise(() => {}));

    render(<SettingsPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    });

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows an error message when api.updateMe rejects", async () => {
    mockUpdateMe.mockRejectedValueOnce(new Error("Network error"));

    render(<SettingsPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Sidebar — logout control
// =============================================================================

describe("Sidebar logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { ...defaultUser };
    mockLogout.mockResolvedValueOnce(undefined);
  });

  it("calls useAuth().logout and redirects to /login when Logout is clicked", async () => {
    render(<Sidebar />);

    const logoutBtn = screen.getByTestId("logout-button");
    expect(logoutBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders the logged-in user email in the sidebar footer", () => {
    render(<Sidebar />);
    expect(screen.getByText("player@example.com")).toBeInTheDocument();
  });

  it("renders a link to /settings in the sidebar footer", () => {
    render(<Sidebar />);
    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });
});

// =============================================================================
// Sidebar — SyncButton with no linked accounts
// =============================================================================

describe("Sidebar SyncButton — no linked accounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { ...defaultUser, lichess_username: null, chesscom_username: null };
  });

  it("disables the Sync Games button when no accounts are linked", () => {
    render(<Sidebar />);
    const syncBtn = screen.getByRole("button", { name: /sync games/i });
    expect(syncBtn).toBeDisabled();
  });

  it("shows a prompt linking to /settings when no accounts are linked", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /link an account/i });
    expect(link).toHaveAttribute("href", "/settings");
  });
});

// =============================================================================
// Sidebar — SyncButton with linked accounts
// =============================================================================

describe("Sidebar SyncButton — with linked accounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { ...defaultUser }; // has both usernames
  });

  it("enables the Sync Games button when at least one account is linked", () => {
    render(<Sidebar />);
    const syncBtn = screen.getByRole("button", { name: /sync games/i });
    expect(syncBtn).not.toBeDisabled();
  });
});
