/**
 * SocialProofMarquee — §21.1 marketing section
 *
 * CSS-animated marquee of logos/quotes/recent-scan chips.
 * - Pure CSS animation (no JS), pausable on hover
 * - prefers-reduced-motion → static (no animation, items shown inline)
 * - Dual-track: items duplicated to create seamless loop
 *
 * Content-as-props: chips array drives all rendering.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarqueeChip {
  /** Display label — e.g. "a journaling app · 63 / 100" */
  label: string;
  /** Optional score for colour-coding (0–100) */
  score?: number;
}

export interface SocialProofMarqueeContent {
  chips: readonly MarqueeChip[];
  /** Section label (accessible + visible mono text above marquee) */
  label?: string;
}

export interface SocialProofMarqueeProps {
  content: SocialProofMarqueeContent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number | undefined): string {
  if (score === undefined) return "var(--color-muted)";
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-accent-400)";
  return "var(--color-warning)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SocialProofMarquee({ content }: SocialProofMarqueeProps) {
  const { chips, label } = content;
  // Duplicate chips so the loop is seamless
  const track = [...chips, ...chips];

  return (
    <section
      aria-label={label ?? "Recent scans — social proof"}
      className="social-proof-section py-8"
    >
      {label && (
        <p
          className="mb-4 text-center font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
          aria-hidden="true"
        >
          {label}
        </p>
      )}

      {/* Marquee container — overflow hidden, fade edges */}
      <div className="marquee-outer relative overflow-hidden">
        {/* Left/right fade masks */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
          style={{
            background:
              "linear-gradient(to right, var(--color-bg) 0%, transparent 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
          style={{
            background:
              "linear-gradient(to left, var(--color-bg) 0%, transparent 100%)",
          }}
        />

        {/* Marquee track */}
        <div
          className="marquee-track flex w-max gap-3 py-1"
          role="list"
          aria-label="Recent product scans"
        >
          {track.map((chip, i) => (
            <span
              key={i}
              role="listitem"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs"
              style={{
                borderColor: "oklch(1 0 0 / 0.08)",
                background: "oklch(1 0 0 / 0.025)",
                color: "var(--color-muted)",
              }}
            >
              {chip.score !== undefined && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: scoreColor(chip.score) }}
                  aria-hidden="true"
                />
              )}
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* CSS animation — reduced-motion-safe */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .marquee-track {
            animation: marquee-scroll 28s linear infinite;
          }
          .marquee-outer:hover .marquee-track {
            animation-play-state: paused;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            flex-wrap: wrap;
            width: auto;
          }
        }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
