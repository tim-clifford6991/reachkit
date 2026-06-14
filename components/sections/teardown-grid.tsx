/**
 * TeardownGrid — §21.1 marketing section
 *
 * Responsive grid of teardown cards. Content-as-props: data supplied
 * externally (teardown data task). Each card shows:
 *   title, app, score (mono), blurb, optional link.
 *
 * Dark-first, on design tokens.
 */

import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeardownCard {
  title: string;
  /** App/product name */
  app: string;
  /** Discoverability score (0–100) */
  score: number;
  blurb: string;
  /** Slug or external URL for full teardown */
  href?: string;
}

export interface TeardownGridContent {
  eyebrow?: string;
  headline: string;
  cards: readonly TeardownCard[];
}

export interface TeardownGridProps {
  content: TeardownGridContent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-accent-400)";
  return "var(--color-warning)";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Needs Work";
  return "Critical";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TeardownCardComponent({ card }: { card: TeardownCard }) {
  const color = scoreColor(card.score);
  const label = scoreLabel(card.score);

  const inner = (
    <article
      className="group flex h-full flex-col gap-4 rounded-2xl border p-7 shadow-[var(--elevation-sm),var(--edge-highlight)] transition-[transform,box-shadow] duration-300 ease-revolut hover:-translate-y-1 hover:shadow-[var(--elevation-lg),var(--edge-highlight)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--gradient-surface)",
      }}
    >
      {/* Score + app */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            {card.app}
          </p>
          <h3
            className="text-sm font-semibold leading-snug"
            style={{ color: "var(--color-fg)" }}
          >
            {card.title}
          </h3>
        </div>

        {/* Score badge */}
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-lg px-2.5 py-1.5"
          style={{
            background: `${color}1a`,
            border: `1px solid ${color}33`,
            minWidth: "3rem",
          }}
          aria-label={`Score: ${card.score} out of 100 — ${label}`}
        >
          <span
            className="font-mono text-base font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {card.score}
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            /100
          </span>
        </div>
      </div>

      {/* Blurb */}
      <p
        className="flex-1 text-sm leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        {card.blurb}
      </p>

      {/* Read more link */}
      {card.href && (
        <p
          className="font-mono text-xs transition-colors duration-150 group-hover:opacity-100"
          style={{ color: "var(--color-accent-400)", opacity: 0.7 }}
        >
          Read teardown →
        </p>
      )}
    </article>
  );

  if (card.href) {
    return (
      <Link
        href={card.href}
        className="block h-full no-underline"
        aria-label={`${card.title} — score ${card.score}/100. Read teardown`}
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function TeardownGrid({ content }: TeardownGridProps) {
  const { eyebrow, headline, cards } = content;

  return (
    <section
      className="flex flex-col items-center gap-14 px-(--spacing-content-x) py-(--spacing-section-y)"
      aria-label="Product teardowns"
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
          className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.1 }}
        >
          {headline}
        </h2>
      </div>

      {/* Grid */}
      <div
        className="grid w-full max-w-[var(--spacing-content-max)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="Teardown cards"
      >
        {cards.map((card) => (
          <div key={card.title} role="listitem" className="flex">
            <TeardownCardComponent card={card} />
          </div>
        ))}
      </div>
    </section>
  );
}
