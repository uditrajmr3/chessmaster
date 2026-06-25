"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof AuthError) {
        setError("Invalid email or password");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="bg-[#222639] rounded-xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Sign in to ChessMaster</h1>

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

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-center text-gray-400">
          <p>
            <Link href="/forgot-password" className="text-[#0ebeb0] hover:underline">
              Forgot your password?
            </Link>
          </p>
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#0ebeb0] hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
