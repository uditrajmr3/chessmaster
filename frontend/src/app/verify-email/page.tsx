"use client";

import { useEffect, useState, Suspense } from "react";
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

type State = "idle" | "loading" | "success" | "error" | "no-token" | "resent";

function VerifyEmailContent() {
  const t = useTranslations("auth");
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
        err instanceof Error ? err.message : t("resendFailed")
      );
    } finally {
      setResending(false);
    }
  }

  if (state === "loading") {
    return <p className="text-white/50 text-sm text-center py-2">{t("verifying")}</p>;
  }

  if (state === "success") {
    return (
      <AuthNotice>
        <p className="font-semibold mb-1 text-accent-100">{t("emailVerifiedTitle")}</p>
        <p>
          {t.rich("emailVerifiedBody", {
            link: (chunks) => <AuthLink href="/login">{chunks}</AuthLink>,
          })}
        </p>
      </AuthNotice>
    );
  }

  if (state === "no-token") {
    return (
      <p className="text-white/55 text-sm text-center py-2">
        {t("checkInbox")}
      </p>
    );
  }

  if (state === "resent") {
    return <AuthNotice>{t("verifyResent")}</AuthNotice>;
  }

  // state === "error"
  return (
    <div className="space-y-5">
      <AuthError>{t("linkInvalidExpired")}</AuthError>
      <form onSubmit={handleResend} noValidate className="space-y-4">
        <div>
          <label htmlFor="resend-email" className={authLabelClass}>
            {t("resendToEmail")}
          </label>
          <input
            id="resend-email"
            type="email"
            autoComplete="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder={t("emailPlaceholderRegister")}
            className={authInputClass}
          />
        </div>
        {resendError && <AuthError>{resendError}</AuthError>}
        <AuthButton type="submit" disabled={resending}>
          {resending ? t("sending") : t("resendVerification")}
        </AuthButton>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  return (
    <AuthShell
      title={t("verifyEmailTitle")}
      footer={<AuthLink href="/login">{t("backToSignIn")}</AuthLink>}
    >
      <Suspense fallback={<p className="text-white/50 text-sm text-center">{t("loading")}</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
