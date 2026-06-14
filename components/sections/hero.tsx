"use client";

/**
 * Hero — §21.1 marketing section
 *
 * Content-as-props server-compatible component with a tasteful CSS entrance
 * animation (reduced-motion-safe). Accepts a CTA slot via `children`.
 *
 * Dark-first, on design tokens, responsive.
 */

import type { ReactNode } from "react";

import { GradientMesh } from "@/components/motion/gradient-mesh";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeroContent {
  /** Small mono label above the headline */
  eyebrow: string;
  /** Headline text before the accent-highlighted span */
  headlineBefore: string;
  /** The accent-highlighted portion of the headline */
  headlineAccent: string;
  /** Headline text after the accent span */
  headlineAfter?: string;
  /** Supporting paragraph */
  subhead: string;
}

export interface HeroProps {
  content: HeroContent;
  /** CTA slot — e.g. <ScanInput /> */
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Hero({ content, children }: HeroProps) {
  const { eyebrow, headlineBefore, headlineAccent, headlineAfter, subhead } =
    content;

  return (
    <section
      className="hero-section relative flex flex-col items-center gap-14 overflow-hidden px-(--spacing-content-x) py-(--spacing-section-y) text-center"
      aria-label="Hero"
    >
      {/* Ambient animated gradient mesh — pure CSS */}
      <GradientMesh />

      <div className="hero-content relative z-10 flex max-w-2xl flex-col items-center gap-6">
        {/* Eyebrow — glass pill */}
        <p
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wider backdrop-blur-[var(--glass-blur)]"
          style={{
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "var(--glass-border)",
            background: "var(--glass-tint)",
            color: "var(--color-accent-400)",
          }}
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: "var(--color-accent-400)" }}
            aria-hidden="true"
          />
          {eyebrow}
        </p>

        {/* Headline */}
        <h1
          className="text-5xl font-bold tracking-[var(--tracking-display)] sm:text-6xl lg:text-7xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.04 }}
        >
          {headlineBefore}
          {headlineBefore && <br />}
          <span
            style={{
              background: "var(--gradient-accent)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {headlineAccent}
          </span>
          {headlineAfter && (
            <>
              <br />
              {headlineAfter}
            </>
          )}
        </h1>

        {/* Subhead */}
        <p
          className="mx-auto max-w-md text-base leading-relaxed sm:text-lg"
          style={{ color: "var(--color-muted)" }}
        >
          {subhead}
        </p>

        {/* CTA slot */}
        {children && <div className="w-full">{children}</div>}
      </div>

      {/* CSS-only entrance animation — reduced-motion-safe */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hero-content {
            animation: hero-fade-up 0.6s cubic-bezier(0.25, 0, 0, 1) both;
          }
        }
        @keyframes hero-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
