"use client";

import { useEffect, useState, Suspense } from "react";
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

type State = "idle" | "loading" | "success" | "error" | "no-token" | "resent";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>(token ? "loading" : "no-token");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .verifyEmail(token)
      .then(() => !cancelled && setState("success"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendError("");
    setResending(true);
    try {
      await api.requestVerify(resendEmail);
      setState("resent");
    } catch (err) {
      setResendError(
        err instanceof Error ? err.message : "Failed to send. Please try again."
      );
    } finally {
      setResending(false);
    }
  }

  if (state === "loading") {
    return <p className="text-white/50 text-sm text-center py-2">Verifying your email…</p>;
  }

  if (state === "success") {
    return (
      <AuthNotice>
        <p className="font-semibold mb-1 text-accent-100">Email verified</p>
        <p>You can now <AuthLink href="/login">sign in</AuthLink>.</p>
      </AuthNotice>
    );
  }

  if (state === "no-token") {
    return (
      <p className="text-white/55 text-sm text-center py-2">
        Check your inbox for a verification link.
      </p>
    );
  }

  if (state === "resent") {
    return <AuthNotice>Verification email sent. Check your inbox.</AuthNotice>;
  }

  // state === "error"
  return (
    <div className="space-y-5">
      <AuthError>The verification link is invalid or has expired.</AuthError>
      <form onSubmit={handleResend} noValidate className="space-y-4">
        <div>
          <label htmlFor="resend-email" className={authLabelClass}>
            Resend to email address
          </label>
          <input
            id="resend-email"
            type="email"
            autoComplete="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="you@example.com"
            className={authInputClass}
          />
        </div>
        {resendError && <AuthError>{resendError}</AuthError>}
        <AuthButton type="submit" disabled={resending}>
          {resending ? "Sending…" : "Resend verification email"}
        </AuthButton>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verify your email"
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    >
      <Suspense fallback={<p className="text-white/50 text-sm text-center">Loading…</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
