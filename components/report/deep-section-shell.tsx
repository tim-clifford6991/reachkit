/**
 * Shared chrome for the deep report sections (competitive landscape, channels,
 * creators, strengths/weaknesses). Server-rendered, content-as-props — mirrors
 * the WhereTheyAreSection look (rounded card, mono eyebrow, hairline border).
 */

import type { ReactNode } from "react";

export function DeepSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
    >
      <div className="px-7 pb-6 pt-6">
        <div className="mb-4">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-base font-semibold" style={{ color: "var(--color-fg)" }}>
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

/** Locked-state footer: a chip linking to the trial CTA (#unlock). */
export function LockNote({ label }: { label: string }) {
  return (
    <a
      href="#unlock"
      className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        borderColor: "var(--color-accent-900)",
        background: "var(--color-accent-subtle)",
        color: "var(--color-accent-400)",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {label}
    </a>
  );
}
