"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");
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
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={<>{t("rememberIt")} <AuthLink href="/login">{t("signIn")}</AuthLink></>}
    >
      {submitted ? (
        <AuthNotice>{t("forgotSubmitted")}</AuthNotice>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className={authLabelClass}>{t("email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholderRegister")}
              className={authInputClass}
            />
          </div>
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? t("sending") : t("sendResetLink")}
          </AuthButton>
        </form>
      )}
    </AuthShell>
  );
}
