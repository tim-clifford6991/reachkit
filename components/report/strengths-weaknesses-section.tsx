/**
 * StrengthsWeaknessesSection — what you do well vs poorly, from review sentiment
 * (loved vs hated themes with quotes) plus the diagnostic findings. Locked on
 * the free teaser; full when paid.
 */

import type { StrengthsAndWeaknesses, ReviewTheme } from "@/lib/scan/report";
import { DeepSection, LockNote } from "./deep-section-shell";

function ThemeList({
  themes,
  tone,
  unlocked,
}: {
  themes: ReviewTheme[];
  tone: "good" | "bad";
  unlocked: boolean;
}) {
  if (themes.length === 0) return null;
  const accent = tone === "good" ? "var(--color-success)" : "var(--color-danger)";
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
        {tone === "good" ? "What they love" : "What they don't"}
      </p>
      <ul className="space-y-2">
        {themes.map((t, i) => (
          <li key={i} className="rounded-lg px-4 py-2.5" style={{ background: "var(--fill-subtle)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
              {t.theme}
            </p>
            {unlocked && t.quote ? (
              <p className="mt-1 text-xs italic leading-snug" style={{ color: "var(--color-muted)" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StrengthsWeaknessesSection({
  data,
  unlocked = true,
}: {
  data?: StrengthsAndWeaknesses;
  unlocked?: boolean;
}) {
  const strengths = data?.strengths ?? [];
  const weaknesses = data?.weaknesses ?? [];
  const diagnostics = data?.diagnostics ?? [];
  if (strengths.length === 0 && weaknesses.length === 0 && diagnostics.length === 0) return null;

  return (
    <DeepSection eyebrow="Strengths & weaknesses" title="What you do well vs poorly">
      <div className="space-y-5">
        <ThemeList themes={strengths} tone="good" unlocked={unlocked} />
        <ThemeList themes={weaknesses} tone="bad" unlocked={unlocked} />

        {unlocked && diagnostics.length > 0 && (
          <div>
            <p
              className="mb-2 font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              Diagnostics
            </p>
            <ul className="space-y-2">
              {diagnostics.map((d, i) => (
                <li key={i} className="text-sm leading-snug" style={{ color: "var(--color-fg)" }}>
                  <span
                    className="mr-2 font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {d.category === "seo_aso" ? "SEO/ASO" : d.category}
                  </span>
                  {d.claim}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!unlocked && <LockNote label="Unlock quotes + full diagnostics with a free trial" />}
    </DeepSection>
  );
}
