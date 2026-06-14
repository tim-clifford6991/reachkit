/**
 * SocialProof — §21.1 marketing section (principles #15, #21, #29).
 *
 * Pre-launch-honest proof band. It does NOT fabricate customer testimonials.
 * Instead it carries:
 *   1. A founder vouch — face + name + quote + an optional 90-second video
 *      (principle #15: a founder people can see and hear).
 *   2. Factual trust points about how the product works (grounded, evidenced).
 *   3. An optional `testimonials` row that renders ONLY when real quotes are
 *      supplied — wire real customer quotes in here as they arrive (principle
 *      #29 / #14). Leave empty until then; the section degrades gracefully.
 *
 * Content-as-props, server component, on design tokens.
 */

import Image from "next/image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FounderVouch {
  name: string;
  role: string;
  quote: string;
  /** Path to a founder headshot in /public. Falls back to a monogram avatar. */
  avatarSrc?: string;
  /** Monogram shown when no avatarSrc (e.g. "TC"). */
  initials: string;
  /** Optional link to a 90-second founder walkthrough (Loom/YouTube). */
  videoUrl?: string;
  videoLabel?: string;
}

export interface ProofPoint {
  /** Big value, e.g. "18" or "Free" */
  value: string;
  /** Caption under the value */
  label: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

export interface SocialProofContent {
  eyebrow?: string;
  headline: string;
  founder: FounderVouch;
  proofPoints: readonly ProofPoint[];
  /** Real customer quotes. Renders nothing extra while empty. */
  testimonials?: readonly Testimonial[];
}

export interface SocialProofProps {
  content: SocialProofContent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SocialProof({ content }: SocialProofProps) {
  const { eyebrow, headline, founder, proofPoints, testimonials } = content;

  return (
    <section
      className="flex flex-col items-center gap-12 px-(--spacing-content-x) py-(--spacing-section-y)"
      aria-label="Proof"
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

      {/* Founder vouch card */}
      <figure
        className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border p-8 sm:p-10"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--gradient-surface)",
          boxShadow: "var(--elevation-md),var(--edge-highlight)",
        }}
      >
        <blockquote
          className="text-lg leading-relaxed sm:text-xl"
          style={{ color: "var(--color-fg)" }}
        >
          “{founder.quote}”
        </blockquote>

        <figcaption className="flex flex-wrap items-center gap-4">
          {/* Avatar — real headshot when provided, else a clearly-marked slot.
              ASSET TODO: set `avatarSrc` in the content to swap the placeholder
              for the real square headshot. */}
          {founder.avatarSrc ? (
            <Image
              src={founder.avatarSrc}
              alt={founder.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <span
              className="grid h-12 w-12 place-items-center rounded-full border border-dashed"
              style={{
                borderColor: "var(--color-accent-400)",
                background: "var(--color-accent-subtle)",
                color: "var(--color-accent-400)",
              }}
              title="Founder headshot — placeholder"
              aria-label="Founder headshot placeholder"
            >
              <PersonIcon />
            </span>
          )}

          <div className="flex flex-col">
            <span className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
              {founder.name}
            </span>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {founder.role}
            </span>
          </div>

          {/* Founder video (#15: see and hear the founder). Renders a real link
              when `videoUrl` is set, otherwise a visible placeholder button so
              the slot can be reviewed before the Loom exists.
              ASSET TODO: set `videoUrl` to make this a live walkthrough link. */}
          {founder.videoUrl ? (
            <a
              href={founder.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--color-fg)" }}
            >
              <PlayIcon />
              {founder.videoLabel ?? "Watch the 90-second story"}
            </a>
          ) : (
            <span
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm font-medium"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--color-muted)" }}
              title="Founder walkthrough video — placeholder"
            >
              <PlayIcon />
              {founder.videoLabel ?? "Watch the 90-second story"}
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                soon
              </span>
            </span>
          )}
        </figcaption>
      </figure>

      {/* Factual proof points */}
      <div
        className="grid w-full max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3"
        style={{ borderColor: "var(--hairline)", background: "var(--hairline)" }}
        role="list"
        aria-label="Proof points"
      >
        {proofPoints.map((p) => (
          <div
            key={p.label}
            role="listitem"
            className="flex flex-col items-center gap-1 px-6 py-7 text-center"
            style={{ background: "var(--color-surface)" }}
          >
            <span
              className="font-mono text-3xl font-bold tabular-nums"
              style={{ color: "var(--color-fg)" }}
            >
              {p.value}
            </span>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>

      {/* Real customer testimonials — renders only when populated */}
      {testimonials && testimonials.length > 0 && (
        <div
          className="grid w-full max-w-4xl grid-cols-1 gap-5 md:grid-cols-3"
          role="list"
          aria-label="Customer testimonials"
        >
          {testimonials.map((t) => (
            <figure
              key={t.name}
              role="listitem"
              className="flex h-full flex-col gap-4 rounded-2xl border p-6"
              style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
            >
              <blockquote className="text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-auto text-sm">
                <span className="font-semibold" style={{ color: "var(--color-fg)" }}>
                  {t.name}
                </span>
                <span style={{ color: "var(--color-muted)" }}> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline icons (no icon-lib weight in the marketing bundle)
// ---------------------------------------------------------------------------

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.2" />
      <path d="M4 16.5a6 6 0 0 1 12 0Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <path d="M3 1.5v10l8.5-5L3 1.5Z" />
    </svg>
  );
}
