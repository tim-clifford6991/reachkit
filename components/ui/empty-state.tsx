/**
 * EmptyState — one consistent, designed empty/zero-data block (dashed card, icon,
 * title, hint, optional CTA) so data surfaces guide instead of vanishing. Used
 * across the analytical surfaces in place of ad-hoc "return null".
 */

import Link from "next/link";

export function EmptyState({
  title,
  hint,
  cta,
  tone = "neutral",
}: {
  title: string;
  hint?: string;
  cta?: { label: string; href: string };
  /** "positive" tints the icon success-green (a good zero — e.g. no open issues). */
  tone?: "neutral" | "positive";
}) {
  const accent = tone === "positive" ? "var(--color-success)" : "var(--color-muted)";
  return (
    <div
      className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center"
      style={{ borderColor: "var(--hairline-strong)", background: "var(--color-surface)" }}
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-full" style={{ background: "var(--fill-subtle)" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: accent }}>
          {tone === "positive" ? (
            <path d="M3.5 8.5L6.5 11.5L12.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 5.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="10.8" r="0.8" fill="currentColor" />
            </>
          )}
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-snug" style={{ color: "var(--color-muted)" }}>{hint}</p>}
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ background: "var(--color-accent-500)", color: "var(--color-on-accent, white)" }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
