/* @mirrors components/app/intel/dashboard-view.tsx */
import * as React from "react";

/**
 * "You vs. top competitors" — the dashboard's competitive card (the sole DS mirror
 * of `dashboard-view.tsx`). LEFT: a clickable footprint-strength ranking
 * ("Footprint /100"). RIGHT: a per-entity BACKLINK CHANNEL MIX — honest COUNTS of
 * quality backlinks per channel (from `backlinks.byCategory`). This right column
 * REPLACED the old "traffic by channel" donut, whose shares were a log-normalised
 * blend of backlink counts + branded-search volume presented as % of TRAFFIC
 * (existence-as-magnitude, dropped 2026-07-28, R-6.7/R-1.10). Component name kept
 * as TrafficByChannel for the DS import graph.
 */
export interface TrafficByChannelProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

const RANK = [
  { name: "You", score: 88, color: "var(--c-band-findable)", subject: true },
  { name: "fellow.ai", score: 74, color: "var(--c-band-fair)" },
  { name: "read.ai", score: 61, color: "var(--c-band-fair)" },
  { name: "zocks.io", score: 43, color: "var(--c-band-hard)" },
];
const MAX_SCORE = 100;

// All quality channels the live channelMix can render (QUALITY_CHANNELS).
const CHANNELS = [
  { label: "Directories", count: 14, color: "var(--c-action)" },
  { label: "Community", count: 9, color: "var(--c-band-findable)" },
  { label: "Marketplaces", count: 6, color: "var(--c-band-fair)" },
  { label: "Media & press", count: 4, color: "var(--c-band-hard)" },
  { label: "Blogs", count: 3, color: "var(--c-action)" },
  { label: "Partners", count: 2, color: "var(--c-band-findable)" },
  { label: "Social", count: 2, color: "var(--c-band-fair)" },
  { label: "Newsletters", count: 1, color: "var(--c-band-hard)" },
];
const MAX_COUNT = Math.max(1, ...CHANNELS.map((c) => c.count));

export function TrafficByChannel() {
  return (
    <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>You vs. top competitors</h3>
        <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-muted)" }}>#1 of 4</span>
      </div>
      <div style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {/* Left: footprint-strength ranking */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 9px 2px" }}>
            <span style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)" }}>click to inspect →</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)", whiteSpace: "nowrap" }}>Footprint&nbsp;/100</span>
          </div>
          {RANK.map((e) => (
            <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: "var(--radius-lg)", background: e.subject ? "var(--c-soft)" : "transparent" }}>
              <span style={{ width: 118, flexShrink: 0, fontSize: 13, fontWeight: e.subject ? 700 : 500, color: e.subject ? "var(--c-action)" : "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</span>
              <span style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--c-fill)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(e.score / MAX_SCORE) * 100}%`, background: e.color, borderRadius: 4 }} />
              </span>
              <span style={{ width: 26, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 13, fontWeight: 700, color: e.color }}>{e.score}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)" }}>See the full cohort →</span>
          </div>
        </div>
        {/* Right: backlink channel mix */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-action)" }}>Your backlink channel mix</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "4px 0 14px" }}>
            {CHANNELS.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 104, flexShrink: 0, fontSize: 12, color: "var(--c-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--c-fill)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(c.count / MAX_COUNT) * 100}%`, background: c.color, borderRadius: 4 }} />
                </span>
                <span style={{ width: 26, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 12.5, fontWeight: 700, color: "var(--c-muted)" }}>{c.count}</span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--c-faint)", margin: "2px 0 0" }}>Quality backlinks per channel — where you&apos;re placed.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["Referring domains", "960"], ["Organic keywords", "12.4k"]].map(([l, v]) => (
              <div key={l} style={{ flex: "1 1 130px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: JM, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>{l}</span>
                <b style={{ fontFamily: SG, fontWeight: 700, fontSize: 23, color: "var(--c-ink)", lineHeight: 1 }}>{v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
