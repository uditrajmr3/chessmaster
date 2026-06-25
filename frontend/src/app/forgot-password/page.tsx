"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.forgotPassword(email);
    } catch {
      // Intentionally swallow errors — we never reveal whether an account exists.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="bg-[#222639] rounded-xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-2">Forgot password</h1>
        <p className="text-gray-400 text-sm mb-6">
          Enter your email and we&apos;ll send you a reset link if an account exists.
        </p>

        {submitted ? (
          <div className="bg-[#0ebeb0]/10 border border-[#0ebeb0]/30 rounded-lg p-4 text-[#0ebeb0] text-sm">
            If that email is registered, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-[#1a1d27] border border-[#2e3348] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0ebeb0] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#0ebeb0] hover:bg-[#089990] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Remember your password?{" "}
          <Link href="/login" className="text-[#0ebeb0] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
