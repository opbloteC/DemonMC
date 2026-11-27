"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, LockIcon, MailIcon } from "@/components/icons";
import { isEmailAddress } from "@/lib/validation";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const SUCCESS_MESSAGE = "We've sent a verification code to your email address.";

type Step = "email" | "code";

export function ForgotPasswordForm({ brandName = "DemonMC" }: { brandName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const emailInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(target: string): Promise<boolean> {
    if (pending) return false;
    setPending(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!res.ok) {
        setError(data?.error ?? "Unable to send the verification code. Please try again.");
        return false;
      }

      setSentTo(target);
      setStep("code");
      setDigits(Array(CODE_LENGTH).fill(""));
      setNotice(data?.message ?? SUCCESS_MESSAGE);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      window.setTimeout(() => boxes.current[0]?.focus(), 0);
      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function onSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const target = email.trim().toLowerCase();
    if (!target) {
      setError("Enter your email address.");
      emailInput.current?.focus();
      return;
    }
    if (!isEmailAddress(target)) {
      setError("Enter a valid email address.");
      emailInput.current?.focus();
      return;
    }

    await requestCode(target);
  }

  function writeDigits(start: number, value: string) {
    const chars = value.replace(/\D/g, "");
    if (!chars) return;

    setDigits((current) => {
      const next = [...current];
      for (let index = 0; index < chars.length && start + index < CODE_LENGTH; index += 1) {
        next[start + index] = chars[index];
      }
      return next;
    });
    if (error) setError("");

    const focusIndex = Math.min(start + chars.length, CODE_LENGTH - 1);
    window.setTimeout(() => boxes.current[focusIndex]?.focus(), 0);
  }

  function handleDigitChange(index: number, raw: string) {
    const chars = raw.replace(/\D/g, "");
    if (!chars) {
      setDigits((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    if (chars.length > 1) {
      writeDigits(index, chars);
      return;
    }

    setDigits((current) => {
      const next = [...current];
      next[index] = chars;
      return next;
    });
    if (error) setError("");
    if (index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  function handleDigitKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const current = digits[index];
      setDigits((values) => {
        const next = [...values];
        if (next[index]) {
          next[index] = "";
        } else if (index > 0) {
          next[index - 1] = "";
        }
        return next;
      });
      if (error) setError("");
      if (!current && index > 0) boxes.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      boxes.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  }

  function handleDigitPaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    writeDigits(pasted.length >= CODE_LENGTH ? 0 : index, pasted.slice(0, CODE_LENGTH));
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying) return;

    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setError("Enter all six digits from the email.");
      boxes.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sentTo, code }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(data?.error ?? "Unable to verify the code. Please try again.");
        setDigits(Array(CODE_LENGTH).fill(""));
        window.setTimeout(() => boxes.current[0]?.focus(), 0);
        return;
      }

      router.replace("/reset-password");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    if (pending || verifying || cooldown > 0) return;
    await requestCode(sentTo || email.trim().toLowerCase());
  }

  function useDifferentEmail() {
    setStep("email");
    setDigits(Array(CODE_LENGTH).fill(""));
    setNotice("");
    setError("");
    setCooldown(0);
    window.setTimeout(() => emailInput.current?.focus(), 0);
  }

  if (step === "code") {
    return (
      <div className="mt-7">
        <div className="flex flex-col items-center rounded-xl border border-aqua-200 bg-aqua-50/70 px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-aqua-200 bg-white text-aqua-700 shadow-sm">
            <MailIcon width={22} height={22} />
          </span>
          <h3 className="mt-4 font-display text-base font-bold text-navy-900">
            Enter your verification code
          </h3>
          <p role="status" aria-live="polite" className="mt-2 max-w-[320px] text-xs leading-relaxed text-navy-500">
            {notice || SUCCESS_MESSAGE}
          </p>
          {sentTo && (
            <p className="mt-1 max-w-[320px] break-all text-[11px] leading-relaxed text-navy-400">
              Sent to <span className="font-semibold text-navy-700">{sentTo}</span>
            </p>
          )}
        </div>

        <form onSubmit={onVerify} method="post" action="/forgot-password" className="mt-5 space-y-4" noValidate>
          <fieldset>
            <legend className="sr-only">Six-digit verification code</legend>
            <div className="flex justify-center gap-2 sm:gap-2.5">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    boxes.current[index] = node;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                  maxLength={1}
                  disabled={verifying}
                  value={digit}
                  onChange={(event) => handleDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleDigitKeyDown(index, event)}
                  onPaste={(event) => handleDigitPaste(index, event)}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-12 w-10 rounded-lg border border-aqua-200 bg-white text-center font-mono text-lg font-bold text-navy-900 shadow-sm transition-colors focus:border-aqua-400 focus:outline-none focus:ring-4 focus:ring-aqua-100 disabled:opacity-60 sm:h-14 sm:w-12 sm:text-xl"
                />
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-navy-400">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon width={13} height={13} />
              Code expires in 10 minutes.
            </span>
            <button
              type="button"
              onClick={onResend}
              disabled={pending || verifying || cooldown > 0}
              className="font-semibold text-aqua-700 transition-colors hover:text-aqua-800 disabled:cursor-not-allowed disabled:text-navy-300"
            >
              {pending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-600"
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={verifying || pending} className="btn-primary w-full !py-3">
            {verifying ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Verifying…
              </>
            ) : (
              <>
                <LockIcon width={15} height={15} />
                Verify code
              </>
            )}
          </button>
        </form>

        <div className="divider my-6" />

        <div className="space-y-2 text-center text-[11px] leading-relaxed text-navy-400">
          <p>
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={useDifferentEmail}
              className="font-semibold text-aqua-700 transition-colors hover:text-aqua-800"
            >
              use a different email
            </button>
            .
          </p>
          <p>
            Remembered your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-aqua-700 transition-colors hover:text-aqua-800"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSendCode} method="post" action="/forgot-password" className="mt-7 space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="label">
          Account email
        </label>
        <input
          id="email"
          ref={emailInput}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          maxLength={254}
          disabled={pending}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
          }}
          className="input"
          placeholder="you@example.com"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-navy-400">
          Enter the email address registered to your {brandName} account. We&apos;ll send a
          6-digit verification code.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-600"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
        {pending ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Sending code…
          </>
        ) : (
          <>
            <MailIcon width={15} height={15} />
            Send code
          </>
        )}
      </button>

      <div className="divider my-6" />

      <p className="text-center text-[11px] leading-relaxed text-navy-400">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-aqua-700 transition-colors hover:text-aqua-800"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
