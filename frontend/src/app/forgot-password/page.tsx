"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  AuthShell,
  AuthButton,
  AuthNotice,
  AuthLink,
  authInputClass,
  authLabelClass,
} from "@/components/ui/auth-shell";

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
      // Never reveal whether an account exists.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we'll send a reset link if an account exists."
      footer={<>Remember it? <AuthLink href="/login">Sign in</AuthLink></>}
    >
      {submitted ? (
        <AuthNotice>If that email is registered, a reset link is on its way.</AuthNotice>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className={authLabelClass}>Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={authInputClass}
            />
          </div>
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send reset link"}
          </AuthButton>
        </form>
      )}
    </AuthShell>
  );
}
