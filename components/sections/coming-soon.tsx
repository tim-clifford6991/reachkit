import Link from "next/link";

/**
 * ComingSoon — a calm, branded placeholder for pages that are linked from the
 * nav/footer but not built yet (Roadmap, Status). Routes using this should also
 * export `robots: { index: false }` so search engines don't index empty pages.
 *
 * Design idiom: intel-kit — inline styles + `--c-*` tokens, Space Grotesk /
 * Plus Jakarta Sans / JetBrains Mono.
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
      style={{ minHeight: "62vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--spacing-section-y, 96px) var(--spacing-content-x, 24px)", textAlign: "center", fontFamily: "var(--font-sans)" }}
      aria-label={title}
    >
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>
        {eyebrow}
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(34px, 5vw, 46px)", letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--c-ink)", margin: "12px 0 0" }}>
        {title}
      </h1>
      <p style={{ maxWidth: 448, fontSize: 17, lineHeight: 1.6, color: "var(--c-muted)", margin: "16px 0 0" }}>
        {blurb}
      </p>
      <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Link
          href="/scan"
          style={{ display: "inline-flex", alignItems: "center", height: 44, background: "var(--c-action)", color: "var(--c-on-dark)", fontWeight: 600, fontSize: 13.5, padding: "0 20px", borderRadius: 12, textDecoration: "none", boxShadow: "0 10px 26px -12px color-mix(in oklab, var(--c-action) 55%, transparent)" }}
        >
          Scan your product
        </Link>
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", height: 44, background: "var(--c-surface)", border: "1px solid var(--c-line)", color: "var(--c-ink)", fontWeight: 500, fontSize: 13.5, padding: "0 20px", borderRadius: 12, textDecoration: "none" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
