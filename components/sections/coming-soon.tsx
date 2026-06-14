import Link from "next/link";

/**
 * ComingSoon — a calm, branded placeholder for pages that are linked from the
 * nav/footer but not built yet (Blog, Changelog, Roadmap, Docs, Status). Routes
 * using this should also export `robots: { index: false }` so search engines
 * don't index empty pages.
 */
export function ComingSoon({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
}) {
  return (
    <main
      className="flex min-h-[62vh] flex-col items-center justify-center px-(--spacing-content-x) py-(--spacing-section-y) text-center"
      aria-label={title}
    >
      <p
        className="font-mono text-[11px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        {eyebrow}
      </p>
      <h1
        className="mt-3 text-4xl sm:text-5xl"
        style={{ color: "var(--color-fg)", lineHeight: 1.05 }}
      >
        {title}
      </h1>
      <p
        className="mt-4 max-w-md text-lg leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        {blurb}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/scan"
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          Scan your product
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          style={{ borderColor: "var(--hairline)", color: "var(--color-fg)" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
