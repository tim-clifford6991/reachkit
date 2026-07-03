"use client";

/**
 * Setup overlay · Step 1 — profile. Ports the original /app/onboarding form
 * (name, distribution goal, ICP confirm) into the intel-kit idiom: inline
 * styles reading `--c-*` tokens, Space Grotesk / Plus Jakarta / JetBrains Mono.
 * Persists via `saveOnboardingStep` (the non-redirecting variant of the
 * existing `saveOnboarding` server action) and advances the stepper in place.
 */

import { useState, useTransition } from "react";
import { saveOnboardingStep } from "@/app/(app)/app/onboarding/actions";

const SG = "var(--font-display)", PJ = "var(--font-sans)";

const GOALS = [
  "More signups / installs",
  "Launch on Product Hunt / Hacker News",
  "Rank for key search terms",
  "Find creators & communities to reach",
  "Not sure yet — show me what works",
];

const LABEL: React.CSSProperties = { display: "block", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: "var(--c-ink)", marginBottom: 6 };
const HINT: React.CSSProperties = { fontFamily: PJ, fontSize: 12, color: "var(--c-muted)", margin: "0 0 8px" };
const FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "var(--c-bg)", border: "1px solid var(--c-line)",
  borderRadius: "var(--radius-lg)", padding: "11px 14px", fontFamily: PJ, fontSize: 14,
  color: "var(--c-ink)", outline: "none", lineHeight: 1.4,
};

export function SetupProfileStep({
  icpSignals,
  hasApp,
  onDone,
}: {
  icpSignals: string[];
  hasApp: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await saveOnboardingStep(fd);
      if (res.ok) onDone();
      else setError(res.error ?? "Something went wrong — please try again.");
    });
  }

  return (
    <div>
      <style>{`.rk-setup-field:focus { border-color: var(--c-action) !important; box-shadow: 0 0 0 3px var(--c-soft); }`}</style>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-action)" }}>Welcome to ReachKit</div>
      <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "6px 0 0" }}>
        Let&apos;s set up your engine
      </h1>
      <p style={{ fontFamily: PJ, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "8px 0 0", maxWidth: 480 }}>
        Two quick things so every recommendation is grounded in what you actually
        want to achieve. Takes about a minute.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Name */}
        <div>
          <label htmlFor="setup_display_name" style={LABEL}>What should we call you?</label>
          <input
            id="setup_display_name"
            name="display_name"
            type="text"
            autoComplete="name"
            autoFocus
            placeholder="Your name"
            className="rk-setup-field"
            style={FIELD}
          />
        </div>

        {/* Distribution goal */}
        <div>
          <label htmlFor="setup_distribution_goal" style={LABEL}>What&apos;s your primary distribution goal right now?</label>
          <select id="setup_distribution_goal" name="distribution_goal" defaultValue="" className="rk-setup-field" style={{ ...FIELD, appearance: "auto" }}>
            <option value="" disabled>Choose a focus…</option>
            {GOALS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* ICP confirm — scan-first users only */}
        {hasApp && (
          <div>
            <label htmlFor="setup_icp_confirmed" style={LABEL}>Who&apos;s your ideal customer? (we detected these — edit freely)</label>
            <p style={HINT}>One trait per line. This grounds your competitive and channel analysis.</p>
            <textarea
              id="setup_icp_confirmed"
              name="icp_confirmed"
              rows={Math.min(Math.max(icpSignals.length, 3), 8)}
              defaultValue={icpSignals.join("\n")}
              placeholder={"e.g. solo founders\nindie developers\nproductivity enthusiasts"}
              className="rk-setup-field"
              style={{ ...FIELD, resize: "vertical" }}
            />
          </div>
        )}

        {error && (
          <p role="alert" style={{ fontFamily: PJ, fontSize: 12.5, color: "#e5484d", margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            style={{
              background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: PJ, fontWeight: 600,
              fontSize: 13.5, padding: "11px 22px", borderRadius: "var(--radius-lg)", border: "none",
              cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Saving…" : "Continue →"}
          </button>
          <span style={{ fontFamily: PJ, fontSize: 12, color: "var(--c-faint)" }}>
            {hasApp ? "Next: pick your competitors" : "Next: calculate your data"}
          </span>
        </div>
      </form>
    </div>
  );
}
