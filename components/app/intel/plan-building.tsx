"use client";

/**
 * PlanBuildingHero — the first-load experience for /app/plan: instead of a
 * spinner, the founder watches ReachKit do the actual work. The full job list
 * is shown UP FRONT (competitors, customers/ICP, demand, reviews, synthesis)
 * and fills in live as the real pipeline stages stream through — proof of
 * work, not a loading bar.
 *
 * Stage keys map 1:1 to the onStage events the gatherers emit
 * (funnel/keyword-gap/demand/synthesis) via /api/app/intel/stream. Unknown
 * keys append gracefully, so new pipeline stages never break the display.
 */

import type { IntelStage } from "@/components/app/intel/shared";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

/** The whole job, promised up front — keyed to the real pipeline events. */
const EXPECTED: { key: string; label: string }[] = [
  { key: "funnel:profile", label: "Profiling your live site" },
  { key: "funnel:competitors", label: "Finding & ranking your competitors" },
  { key: "funnel:backlinks", label: "Measuring traffic & backlinks" },
  { key: "funnel:gaps", label: "Mapping content gaps" },
  { key: "kw:gaps", label: "Finding keywords your rivals win" },
  { key: "demand:icp", label: "Decoding your customers & ICP" },
  { key: "demand:keywords", label: "Sizing real search demand" },
  { key: "demand:community", label: "Listening where your buyers ask" },
  { key: "demand:reviews", label: "Mining competitor reviews" },
  { key: "synthesis:plan", label: "Building your 30-day plan" },
];

type RowState = "pending" | "active" | "done";

export function PlanBuildingHero({ stages }: { stages: IntelStage[] }) {
  const byKey = new Map(stages.map((s) => [s.key, s]));

  // Merge: the expected list first (live state where the stream has reached),
  // then any unexpected extra stages the pipeline emitted.
  const rows: { key: string; label: string; detail?: string; state: RowState }[] = EXPECTED.map((e) => {
    const live = byKey.get(e.key);
    return {
      key: e.key,
      label: e.label,
      detail: live?.detail,
      state: live ? (live.done ? "done" : "active") : "pending",
    };
  });
  for (const s of stages) {
    if (!EXPECTED.some((e) => e.key === s.key)) {
      rows.push({ key: s.key, label: s.label, detail: s.detail, state: s.done ? "done" : "active" });
    }
  }
  const doneCount = rows.filter((r) => r.state === "done").length;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 16px 72px" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pbPulse{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      <div style={{ width: "100%", maxWidth: 560, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "30px 32px 26px", boxShadow: "0 18px 50px oklch(0.2 0.02 290 / 0.08)" }}>
        <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0, animation: "pbPulse 2s ease-in-out infinite" }}>
          ReachKit is working
        </p>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "8px 0 6px" }}>
          Building your 30-day plan
        </h2>
        <p style={{ fontFamily: PJ, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "0 0 18px" }}>
          Reading your live site, ranking your competitors, decoding what your buyers actually search —
          and turning all of it into a day-by-day roadmap. Every step below is real work on your real market.
        </p>

        {/* Progress line */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--c-fill)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, Math.round((doneCount / rows.length) * 100))}%`, height: "100%", background: "var(--c-action)", transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, color: "var(--c-faint)", whiteSpace: "nowrap" }}>{doneCount}/{rows.length}</span>
        </div>

        {/* The job list, filling in live */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, opacity: r.state === "pending" ? 0.45 : 1, transition: "opacity 0.3s ease" }}>
              {r.state === "done" ? (
                <span style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--c-action)", borderRadius: "var(--radius-full)" }}>✓</span>
              ) : r.state === "active" ? (
                <span style={{ width: 18, height: 18, borderRadius: "var(--radius-full)", border: "2px solid var(--c-soft)", borderTopColor: "var(--c-action)", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
              ) : (
                <span style={{ width: 18, height: 18, borderRadius: "var(--radius-full)", border: "2px solid var(--c-line)", display: "inline-block", flexShrink: 0 }} />
              )}
              <span style={{ fontFamily: PJ, fontSize: 13.5, fontWeight: r.state === "active" ? 700 : 500, color: r.state === "done" ? "var(--c-muted)" : "var(--c-ink)", lineHeight: 1.35, minWidth: 0 }}>
                {r.label}
                {r.detail && <span style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 500, color: "var(--c-action)", marginLeft: 7 }}>{r.detail}</span>}
              </span>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", margin: "18px 0 0", lineHeight: 1.6 }}>
          This deep pass runs once — afterwards your plan stays live, rolls 30 days ahead, and your score
          updates as you ship.
        </p>
      </div>
    </div>
  );
}
