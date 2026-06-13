/**
 * PricingTable — §21.1 marketing section
 *
 * Reusable section wrapping the three tier cards (Free / Solo $29 / Growth $99).
 * The existing /pricing page composes this section.
 *
 * CTA slots are passed as ReactNode per tier so the page can inject either
 * a link (unauthed) or the PricingCheckoutLinks client component (authed flow).
 *
 * Pure server component — CTA slot components bring their own client boundary.
 */

import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingTier {
  name: string;
  /** Formatted price string: "$0", "$29", etc. */
  price: string;
  /** Period label: "forever", "/ month", etc. */
  period: string;
  description: string;
  features: readonly string[];
  /** Whether to highlight this tier visually */
  highlighted?: boolean;
  /** Badge text (e.g. "Most popular") — only rendered when set */
  badge?: string;
  /** CTA element injected from the page */
  cta: ReactNode;
}

export interface PricingTableContent {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  tiers: readonly PricingTier[];
}

export interface PricingTableProps {
  content: PricingTableContent;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: "2px" }}
    >
      <circle cx="7" cy="7" r="6" stroke={color} strokeWidth="1.25" />
      <path
        d="M4.5 7l1.75 1.75L9.5 5"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TierCard({ tier }: { tier: PricingTier }) {
  const checkColor = tier.highlighted
    ? "var(--color-accent-400)"
    : "var(--color-muted)";

  return (
    <article
      className="relative flex flex-col rounded-xl p-6"
      style={{
        border: tier.highlighted
          ? "1px solid var(--color-accent-900)"
          : "1px solid oklch(1 0 0 / 0.09)",
        background: tier.highlighted
          ? "oklch(0.60 0.18 255 / 0.05)"
          : "var(--color-surface)",
      }}
      aria-label={`${tier.name} plan — ${tier.price}${tier.period !== "forever" ? tier.period : " forever"}`}
    >
      {/* Badge */}
      {tier.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{
            background: "var(--color-accent-600)",
            color: "var(--color-accent-fg)",
          }}
        >
          {tier.badge}
        </div>
      )}

      {/* Tier name */}
      <p
        className="mb-2 font-mono text-[10px] uppercase tracking-wider"
        style={{
          color: tier.highlighted
            ? "var(--color-accent-400)"
            : "var(--color-muted)",
        }}
      >
        {tier.name}
      </p>

      {/* Price */}
      <div className="mb-2 flex items-baseline gap-1">
        <span
          className="font-mono text-4xl font-bold tabular-nums leading-none"
          style={{ color: "var(--color-fg)" }}
        >
          {tier.price}
        </span>
        <span
          className="font-mono text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          {tier.period}
        </span>
      </div>

      {/* Description */}
      <p
        className="mb-5 text-sm leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        {tier.description}
      </p>

      {/* Feature list */}
      <ul className="mb-6 flex flex-col gap-2.5" aria-label={`${tier.name} features`}>
        {tier.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-sm"
            style={{ color: "var(--color-fg)" }}
          >
            <CheckIcon color={checkColor} />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA slot */}
      <div className="mt-auto">{tier.cta}</div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function PricingTable({ content }: PricingTableProps) {
  const { eyebrow, headline, subhead, tiers } = content;

  return (
    <section
      className="flex flex-col items-center gap-12 px-[--spacing-content-x] py-[--spacing-section-y]"
      aria-label="Pricing"
    >
      {/* Header */}
      <div className="flex max-w-lg flex-col items-center gap-4 text-center">
        {eyebrow && (
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.1 }}
        >
          {headline}
        </h2>
        {subhead && (
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            {subhead}
          </p>
        )}
      </div>

      {/* Tier cards */}
      <div
        className="grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="Pricing tiers"
      >
        {tiers.map((tier) => (
          <div key={tier.name} role="listitem">
            <TierCard tier={tier} />
          </div>
        ))}
      </div>
    </section>
  );
}
