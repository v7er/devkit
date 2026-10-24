import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">
        The link may be outdated, or the utility has not been built yet.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-strong"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to overview
      </Link>
    </div>
  );
}
