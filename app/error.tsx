"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-x flex min-h-[70svh] flex-col items-center justify-center py-16 text-center">
      <div className="panel max-w-lg px-6 py-10 sm:px-10">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="headline mt-3 text-3xl">We could not load this page</h1>
        <p className="mt-3 text-sm leading-relaxed text-navy-500">
          The site hit an unexpected problem. Your data is safe — try again, and if it keeps
          happening let the staff know in the community Discord.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <a href="/" className="btn-ghost">
            Back to home
          </a>
        </div>
      </div>
    </section>
  );
}
