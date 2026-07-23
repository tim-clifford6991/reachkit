/* @mirrors components/app/intel/rank-targets.tsx */
import * as React from "react";

/**
 * WhatToRankFor — the paid dashboard's "what to rank for" growth-engine board.
 * Every row is a SPECIFIC move ("Create a page targeting «keyword»") with its
 * real monthly volume + the subject's live position, ranked by demand — never
 * general advice. Self-contained mirror (sample data, inline tokens) per the
 * PainBars/BuyerThreadFeed convention; the live component composes the intel
 * kit `Card`/`Bar`/`Badge` and reads the persisted opportunity model.
 */
type SampleTarget = { keyword: string; volume: number; yourPosition?: number; rivalsRanking?: number; bestRivalPosition?: number };

const SAMPLE: SampleTarget[] = [
  { keyword: "privacy-first analytics", volume: 1600, yourPosition: 8, rivalsRanking: 4, bestRivalPosition: 2 },
  { keyword: "google analytics alternative", volume: 720, rivalsRanking: 3, bestRivalPosition: 5 },
  { keyword: "cookieless analytics", volume: 480, yourPosition: 14 },
  { keyword: "gdpr compliant analytics", volume: 260 },
  { keyword: "simple website analytics", volume: 140 },
];

const SG = "var(--font-display, 'Space Grotesk')";
const JM = "var(--font-mono, 'JetBrains Mono')";

export function RankTargets() {
  const maxVol = Math.max(...SAMPLE.map((t) => t.volume), 1);
  return (
    <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>What to rank for</h2>
        <span style={{ fontSize: 12, color: "var(--c-faint)", flexShrink: 0 }}>Web Analytics · 302,230/mo</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {SAMPLE.map((t) => {
          const ranks = typeof t.yourPosition === "number";
          const pct = Math.max(6, Math.round((t.volume / maxVol) * 100));
          return (
            <div key={t.keyword}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-ink)", minWidth: 0, overflowWrap: "anywhere" }}>
                  Create a page targeting <span style={{ color: "var(--c-action)" }}>&ldquo;{t.keyword}&rdquo;</span>
                </span>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "baseline", flexShrink: 0 }}>
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 13, color: "var(--c-ink)" }}>{t.volume.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/ mo</span>
                  <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: "var(--radius-full)", color: ranks ? "var(--c-band-fair)" : "var(--c-band-invisible)", background: ranks ? "var(--c-tint-amber)" : "var(--c-tint-red)" }}>
                    {ranks ? `#${t.yourPosition}` : "not ranking"}
                  </span>
                </span>
              </div>
              <div style={{ height: 7, background: "var(--c-fill)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--c-action)", borderRadius: "var(--radius-sm)" }} />
              </div>
              {typeof t.rivalsRanking === "number" && t.rivalsRanking > 0 && (
                <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM }}>
                  {t.rivalsRanking} rival{t.rivalsRanking === 1 ? "" : "s"} rank
                  {typeof t.bestRivalPosition === "number" ? ` · best #${t.bestRivalPosition}` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>+7 more targets</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: SG, fontSize: 13, fontWeight: 700, color: "var(--c-action)", textDecoration: "none", marginLeft: "auto" }}>
          Build these into your plan →
        </a>
      </div>
    </section>
  );
}
