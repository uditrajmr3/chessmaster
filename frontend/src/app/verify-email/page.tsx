"use client";

import { useEffect, useRef, useState, Suspense } from "react";
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

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/** Signup verification — a 6-digit code, not a link (see backend
 * app/routers/email_verification.py). Password reset is untouched and still
 * uses the link flow, handled separately by /reset-password. */
function CodeEntry({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function submit(code: string) {
    setError("");
    setVerifying(true);
    try {
      await api.verifyEmailCode(email, code);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  function updateDigit(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");

    if (clean.length > 1) {
      // Pasted (or autofilled) multiple digits at once.
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      inputRefs.current[Math.min(index + clean.length, CODE_LENGTH - 1)]?.focus();
      if (next.every(Boolean)) void submit(next.join(""));
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (next.every(Boolean)) void submit(next.join(""));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    setResendMsg("");
    setError("");
    try {
      await api.resendVerificationCode(email);
      setResendMsg(t("codeSent"));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resendFailed"));
    }
  }

  if (success) {
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

  return (
    <div className="space-y-5">
      <p className="text-white/55 text-sm">{t("enterCodeSubtitle", { email })}</p>

      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={CODE_LENGTH}
            value={d}
            onChange={(e) => updateDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={verifying}
            aria-label={`Digit ${i + 1}`}
            className="w-11 h-13 text-center text-lg font-mono bg-white/[0.04] border border-white/10 rounded-lg text-white outline-none focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20 transition-all"
          />
        ))}
      </div>

      {error && <AuthError>{error}</AuthError>}
      {resendMsg && !error && <p className="text-xs text-accent-300">{resendMsg}</p>}

      <AuthButton
        type="button"
        onClick={() => digits.every(Boolean) && submit(digits.join(""))}
        disabled={verifying || !digits.every(Boolean)}
      >
        {verifying ? t("verifyingCode") : t("verifyCode")}
      </AuthButton>

      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
        <span className="text-white/45">
          {t("wrongEmail")} <AuthLink href="/register">{t("startOver")}</AuthLink>
        </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="text-accent-300 hover:text-accent-200 disabled:text-white/30 disabled:cursor-not-allowed underline-offset-4 hover:underline"
        >
          {cooldown > 0 ? t("resendCodeIn", { seconds: cooldown }) : t("resendCode")}
        </button>
      </div>
    </div>
  );
}

/** Legacy fallback — an old-style verify link (?token=) still gets handled,
 * for any email sent before this switched to a code. New signups never hit
 * this path (see CodeEntry above). */
function TokenLinkFallback({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
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
      await api.resendVerificationCode(resendEmail);
      setResent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : t("resendFailed"));
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

  if (resent) {
    return <AuthNotice>{t("codeSent")}</AuthNotice>;
  }

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

function VerifyEmailContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (token) return <TokenLinkFallback token={token} />;
  if (email) return <CodeEntry email={email} />;

  return (
    <p className="text-white/55 text-sm text-center py-2">{t("checkInbox")}</p>
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
