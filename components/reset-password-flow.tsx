"use client";

import Link from "next/link";
import { LockIcon } from "@/components/icons";
import { ResetPasswordForm } from "@/components/reset-password-form";

export function ResetPasswordFlow({
  brandName = "DemonMC",
  verified = false,
}: {
  brandName?: string;
  verified?: boolean;
}) {
  if (verified) {
    return <ResetPasswordForm brandName={brandName} />;
  }

  return (
    <div className="mt-7">
      <div className="flex flex-col items-center rounded-xl border border-aqua-200 bg-aqua-50/70 px-5 py-7 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-aqua-200 bg-white text-aqua-700 shadow-sm">
          <LockIcon width={22} height={22} />
        </span>
        <h3 className="mt-4 font-display text-base font-bold text-navy-900">Verification required</h3>
        <p className="mt-2 max-w-[320px] text-xs leading-relaxed text-navy-500">
          Verify the 6-digit code from your email before choosing a new password. Verification
          codes expire after 10 minutes.
        </p>
        <Link href="/forgot-password" className="btn-primary mt-5 w-full !py-3">
          Request a verification code
        </Link>
      </div>

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
    </div>
  );
}
