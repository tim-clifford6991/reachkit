/**
 * FeatureBento — §21.1 marketing section
 *
 * Bento grid of feature cards. Each card has:
 *   - icon (lucide icon component, passed as JSX)
 *   - title
 *   - blurb
 *   - optional span (wide = 2-col span on md+)
 *
 * Dark-first, on design tokens. Responsive bento layout via CSS grid.
 */

import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BentoCard {
  /** Lucide icon (already instantiated: <Search className="..." />) */
  icon: ReactNode;
  title: string;
  blurb: string;
  /** When true the card spans 2 columns on md+ screens */
  wide?: boolean;
  /** Semantic accent override — defaults to neutral */
  accent?: "blue" | "green" | "amber";
}

export interface FeatureBentoContent {
  /** Section eyebrow */
  eyebrow?: string;
  /** Section headline */
  headline: string;
  cards: readonly BentoCard[];
}

export interface FeatureBentoProps {
  content: FeatureBentoContent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCENT_COLORS: Record<"blue" | "green" | "amber", string> = {
  blue: "var(--color-accent-600)",
  green: "var(--color-success)",
  amber: "var(--color-warning)",
};

const ACCENT_SUBTLES: Record<"blue" | "green" | "amber", string> = {
  blue: "var(--color-accent-subtle)",
  green: "var(--color-success-subtle)",
  amber: "var(--color-warning-subtle)",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BentoCardComponent({ card }: { card: BentoCard }) {
  const color = card.accent ? ACCENT_COLORS[card.accent] : "var(--color-accent-600)";
  const subtle = card.accent
    ? ACCENT_SUBTLES[card.accent]
    : "var(--color-accent-subtle)";

  return (
    <div
      className={[
        "group relative flex flex-col gap-4 overflow-hidden rounded-xl border p-5",
        "transition-all duration-200",
        card.wide ? "md:col-span-2" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderColor: "oklch(1 0 0 / 0.08)",
        background: "var(--color-surface)",
      }}
    >
      {/* Subtle hover glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse at 30% 0%, ${subtle} 0%, transparent 70%)`,
        }}
      />

      {/* Icon */}
      <div
        className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: subtle, color }}
      >
        {card.icon}
      </div>

      {/* Text */}
      <div className="relative z-10 flex flex-col gap-1.5">
        <h3
          className="text-sm font-semibold leading-snug"
          style={{ color: "var(--color-fg)" }}
        >
          {card.title}
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          {card.blurb}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function FeatureBento({ content }: FeatureBentoProps) {
  const { eyebrow, headline, cards } = content;

  return (
    <section
      className="flex flex-col items-center gap-10 px-[--spacing-content-x] py-[--spacing-section-y]"
      aria-label="Features"
    >
      {/* Header */}
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        {eyebrow && (
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.15 }}
        >
          {headline}
        </h2>
      </div>

      {/* Bento grid */}
      <div
        className="grid w-full max-w-[var(--spacing-content-max)] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
        role="list"
        aria-label="Feature cards"
      >
        {cards.map((card) => (
          <div key={card.title} role="listitem">
            <BentoCardComponent card={card} />
          </div>
        ))}
      </div>
    </section>
  );
}
