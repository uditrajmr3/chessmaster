"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

export default function RegisterPage() {
  const t = useTranslations("auth");
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
      setError(t("passwordsNoMatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
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
        setError(t("emailExists"));
      } else {
        setError(message || t("registrationFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AuthShell
        title={t("accountCreatedTitle")}
        subtitle={t("accountCreatedSubtitle")}
        footer={<>{t("alreadyVerified")} <AuthLink href="/login">{t("signIn")}</AuthLink></>}
      >
        <AuthNotice>
          <p className="font-semibold mb-1 text-accent-100">{t("checkEmailTitle")}</p>
          <p>{t("checkEmailBody")}</p>
        </AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("createAccountTitle")}
      subtitle={t("createAccountSubtitle")}
      footer={<>{t("alreadyHaveAccount")} <AuthLink href="/login">{t("signIn")}</AuthLink></>}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

        <div>
          <label htmlFor="password" className={authLabelClass}>{t("password")}</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholderRegister")}
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className={authLabelClass}>{t("confirmPassword")}</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("confirmPasswordPlaceholder")}
            className={authInputClass}
          />
        </div>

        {error && <AuthError>{error}</AuthError>}

        <AuthButton type="submit" disabled={submitting}>
          {submitting ? t("creatingAccount") : t("createAccount")}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
