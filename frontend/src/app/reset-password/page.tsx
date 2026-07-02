"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

function ResetPasswordContent() {
  const t = useTranslations("auth");
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
        {t.rich("resetInvalidLink", {
          link: (chunks) => <AuthLink href="/forgot-password">{chunks}</AuthLink>,
        })}
      </AuthError>
    );
  }

  if (success) {
    return (
      <AuthNotice>
        <p className="font-semibold mb-1 text-accent-100">{t("passwordResetTitle")}</p>
        <p>
          {t.rich("passwordResetBody", {
            link: (chunks) => <AuthLink href="/login">{chunks}</AuthLink>,
          })}
        </p>
      </AuthNotice>
    );
  }

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
      await api.resetPassword(token!, password);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("resetLinkExpired")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="password" className={authLabelClass}>{t("newPassword")}</label>
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
        <label htmlFor="confirm-password" className={authLabelClass}>{t("confirmNewPassword")}</label>
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
        {submitting ? t("resetting") : t("resetPassword")}
      </AuthButton>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  return (
    <AuthShell
      title={t("resetTitle")}
      footer={<AuthLink href="/login">{t("backToSignIn")}</AuthLink>}
    >
      <Suspense fallback={<p className="text-white/50 text-sm text-center">{t("loading")}</p>}>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
