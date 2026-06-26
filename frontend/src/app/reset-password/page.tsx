"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  AuthShell,
  AuthButton,
  AuthNotice,
  AuthError,
  AuthLink,
  authInputClass,
  authLabelClass,
} from "@/components/ui/auth-shell";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthError>
        Invalid or missing reset link. Request a new one from the{" "}
        <AuthLink href="/forgot-password">forgot password</AuthLink> page.
      </AuthError>
    );
  }

  if (success) {
    return (
      <AuthNotice>
        <p className="font-semibold mb-1 text-accent-100">Password reset</p>
        <p>
          You can now <AuthLink href="/login">sign in</AuthLink> with your new
          password.
        </p>
      </AuthNotice>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token!, password);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The reset link is expired or invalid. Please request a new one."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="password" className={authLabelClass}>New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={authInputClass}
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className={authLabelClass}>Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          className={authInputClass}
        />
      </div>

      {error && <AuthError>{error}</AuthError>}

      <AuthButton type="submit" disabled={submitting}>
        {submitting ? "Resetting…" : "Reset password"}
      </AuthButton>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    >
      <Suspense fallback={<p className="text-white/50 text-sm text-center">Loading…</p>}>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
