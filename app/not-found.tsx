import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[70svh] flex-col items-center justify-center py-16 text-center">
      <div className="panel max-w-lg px-6 py-10 sm:px-10">
        <p className="eyebrow">404</p>
        <h1 className="headline mt-3 text-3xl">This page could not be found</h1>
        <p className="mt-3 text-sm leading-relaxed text-navy-500">
          The link may be outdated or the page may have moved. Head back home to keep
          exploring the server.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Back to home
          </Link>
          <Link href="/rules" className="btn-ghost">
            Read the rules
          </Link>
        </div>
      </div>
    </section>
  );
}
