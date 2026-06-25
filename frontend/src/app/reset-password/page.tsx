"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

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
      <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4 text-red-400 text-sm">
        Invalid or missing reset link. Please request a new one from the{" "}
        <Link href="/forgot-password" className="text-[#0ebeb0] hover:underline">
          forgot password
        </Link>{" "}
        page.
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-[#0ebeb0]/10 border border-[#0ebeb0]/30 rounded-lg p-4 text-[#0ebeb0]">
        <p className="font-semibold mb-1">Password reset successfully!</p>
        <p className="text-sm">
          You can now{" "}
          <Link href="/login" className="underline hover:opacity-80">
            sign in
          </Link>{" "}
          with your new password.
        </p>
      </div>
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
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-4">
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 bg-[#1a1d27] border border-[#2e3348] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0ebeb0] focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-1">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 bg-[#1a1d27] border border-[#2e3348] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0ebeb0] focus:border-transparent"
        />
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-sm mb-4">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 px-4 bg-[#0ebeb0] hover:bg-[#089990] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="bg-[#222639] rounded-xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Reset your password</h1>

        <Suspense
          fallback={
            <p className="text-gray-400 text-sm text-center">Loading…</p>
          }
        >
          <ResetPasswordContent />
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
