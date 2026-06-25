"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      await api.register({ email, password });
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.toLowerCase().includes("already exists") ||
        message.toUpperCase().includes("UNIQUE")
      ) {
        setError("An account with that email already exists.");
      } else {
        setError(message || "Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
        <div className="bg-[#222639] rounded-xl p-8 w-full max-w-md shadow-lg">
          <div className="bg-[#0ebeb0]/10 border border-[#0ebeb0]/30 rounded-lg p-4 text-[#0ebeb0]">
            <p className="font-semibold mb-1">Account created!</p>
            <p className="text-sm">Check your email to verify your account.</p>
          </div>
          <p className="mt-6 text-center text-sm text-gray-400">
            Already verified?{" "}
            <Link href="/login" className="text-[#0ebeb0] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="bg-[#222639] rounded-xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Create your account</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
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

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
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
              Confirm password
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
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0ebeb0] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
