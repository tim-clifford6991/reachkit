/**
 * FinalCTA — §21.1 marketing section
 *
 * Closing call-to-action band. Accepts a CTA slot (children) — typically
 * a <ScanInput /> or a plain link button.
 *
 * Dark-first, on design tokens. Strong visual anchor at page bottom.
 */

import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinalCtaContent {
  /** Mono eyebrow label */
  eyebrow?: string;
  headline: string;
  subhead?: string;
}

export interface FinalCtaProps {
  content: FinalCtaContent;
  /** CTA element — <ScanInput /> or a button link */
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinalCta({ content, children }: FinalCtaProps) {
  const { eyebrow, headline, subhead } = content;

  return (
    <section
      className="relative overflow-hidden px-[--spacing-content-x] py-[--spacing-section-y]"
      aria-label="Get started"
    >
      {/* Background glow band */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, oklch(0.60 0.18 255 / 0.10) 0%, transparent 65%)",
        }}
      />

      {/* Top border */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, oklch(1 0 0 / 0.1) 50%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {eyebrow && (
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            {eyebrow}
          </p>
        )}

        <h2
          className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.1 }}
        >
          {headline}
        </h2>

        {subhead && (
          <p
            className="max-w-md text-base leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            {subhead}
          </p>
        )}

        {children && (
          <div className="w-full max-w-lg">{children}</div>
        )}
      </div>
    </section>
  );
}
