"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

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
      .then(() => {
        if (!cancelled) setState("success");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

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
    return (
      <p className="text-gray-400 text-sm text-center">Verifying your email…</p>
    );
  }

  if (state === "success") {
    return (
      <div className="bg-[#0ebeb0]/10 border border-[#0ebeb0]/30 rounded-lg p-4 text-[#0ebeb0]">
        <p className="font-semibold mb-1">Email verified!</p>
        <p className="text-sm">
          You can now{" "}
          <Link href="/login" className="underline hover:opacity-80">
            log in
          </Link>
          .
        </p>
      </div>
    );
  }

  if (state === "no-token") {
    return (
      <p className="text-gray-400 text-sm text-center">
        Check your inbox for a verification link.
      </p>
    );
  }

  if (state === "resent") {
    return (
      <div className="bg-[#0ebeb0]/10 border border-[#0ebeb0]/30 rounded-lg p-4 text-[#0ebeb0] text-sm">
        Verification email sent. Check your inbox.
      </div>
    );
  }

  // state === "error"
  return (
    <div>
      <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4 text-red-400 text-sm mb-6">
        The verification link is invalid or has expired.
      </div>

      <p className="text-gray-300 text-sm mb-4">Resend verification email:</p>

      <form onSubmit={handleResend} noValidate>
        <div className="mb-4">
          <label htmlFor="resend-email" className="block text-sm font-medium text-gray-300 mb-1">
            Email address
          </label>
          <input
            id="resend-email"
            type="email"
            autoComplete="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 bg-[#1a1d27] border border-[#2e3348] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0ebeb0] focus:border-transparent"
          />
        </div>

        {resendError && (
          <p role="alert" className="text-red-400 text-sm mb-3">
            {resendError}
          </p>
        )}

        <button
          type="submit"
          disabled={resending}
          className="w-full py-2.5 px-4 bg-[#0ebeb0] hover:bg-[#089990] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resending ? "Sending…" : "Resend verification email"}
        </button>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="bg-[#222639] rounded-xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Verify your email</h1>

        <Suspense
          fallback={
            <p className="text-gray-400 text-sm text-center">Loading…</p>
          }
        >
          <VerifyEmailContent />
        </Suspense>

        <p className="mt-6 text-center text-sm text-gray-400">
          <Link href="/login" className="text-[#0ebeb0] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
