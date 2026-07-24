/* @mirrors components/app/intel/dashboard-view.tsx */
import * as React from "react";

/**
 * TrafficByChannel — the clean channel-mix component from the analytics
 * dashboard: a donut + clickable channel legend on the left, and a rich
 * selected-channel drill-down (stat cards + top sources + plan CTA) on the right.
 * The tidier replacement for the "you vs competitors" card on the dashboard.
 * Mirrors the channel drilldown in `components/app/intel/dashboard-view.tsx`.
 */
export interface TrafficByChannelProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

type Chan = { label: string; pct: number; visits: string; color: string };
const CHANNELS: Chan[] = [
  { label: "Organic", pct: 46, visits: "1.86k", color: "var(--c-action)" },
  { label: "Direct / brand", pct: 24, visits: "970", color: "var(--c-band-findable)" },
  { label: "Referral", pct: 18, visits: "720", color: "var(--c-band-fair)" },
  { label: "Social", pct: 12, visits: "480", color: "var(--c-band-hard)" },
];
const SELECTED = 0; // Organic
const DETAIL = {
  visits: "1.86k", domains: "42", listLabel: "Top landing pages",
  rows: [
    { primary: "/blog/habit-tracking-guide", meta: "820/mo", share: "31%" },
    { primary: "/features", meta: "540/mo", share: "20%" },
    { primary: "/pricing", meta: "310/mo", share: "12%" },
  ],
  plan: "Publish 2 comparison pages",
};

// donut geometry (r=54, thickness 16, viewBox with -6 pad, rotate -90)
const R = 54, C = 2 * Math.PI * R;

export function TrafficByChannel() {
  const sel = CHANNELS[SELECTED];
  let off = 0;
  return (
    <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>Traffic by channel</h3>
        <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Where your reach comes from — pick a channel to drill in.</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
        {/* left: donut + legend */}
        <div style={{ flex: "1 1 250px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 168, height: 168, flex: "0 0 auto" }}>
              <svg viewBox="-6 -6 132 132" width="168" height="168"><g transform="rotate(-90 60 60)" fill="none" strokeWidth="16">
                <circle cx="60" cy="60" r={R} stroke="var(--c-fill)" />
                {CHANNELS.map((c) => { const dash = (c.pct / 100) * C; const el = <circle key={c.label} cx="60" cy="60" r={R} stroke={c.color} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} />; off += dash; return el; })}
              </g></svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <b style={{ fontFamily: JM, fontWeight: 700, fontSize: 30, lineHeight: 1, color: sel.color }}>{sel.pct}%</b>
                <span style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 600, marginTop: 2 }}>{sel.label}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CHANNELS.map((c, i) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: "var(--radius-sm)", border: `1.5px solid ${i === SELECTED ? "var(--c-action)" : "transparent"}`, background: i === SELECTED ? "var(--c-soft)" : "transparent", fontSize: 13, cursor: "pointer" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: "0 0 auto" }} />
                <span style={{ flex: 1, color: "var(--c-ink)", fontWeight: 600 }}>{c.label}</span>
                <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-muted)" }}>{c.visits}</span>
                <span style={{ fontFamily: JM, fontWeight: 700, color: "var(--c-ink)", minWidth: 34, textAlign: "right" }}>{c.pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 4, textAlign: "right" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", cursor: "pointer" }}>See the full cohort →</span>
          </div>
        </div>
        {/* right: selected channel detail */}
        <div style={{ flex: "1.6 1 330px", minWidth: 0, alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16, paddingLeft: 28, borderLeft: "1px solid var(--c-line2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: sel.color, flex: "0 0 auto" }} />
            <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, color: "var(--c-ink)" }}>{sel.label}</span>
            <span style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: 999 }}>{sel.pct}% of traffic</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["Est. visits / mo", DETAIL.visits, ""], ["Share of voice", "38%", "of cohort traffic"], ["Referring domains", DETAIL.domains, ""]].map(([l, v, sub]) => (
              <div key={l} style={{ flex: "1 1 130px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: JM, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>{l}</span>
                <b style={{ fontFamily: SG, fontWeight: 700, fontSize: 23, color: "var(--c-ink)", lineHeight: 1 }}>{v}</b>
                {sub && <span style={{ fontSize: 11, color: "var(--c-muted)" }}>{sub}</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={{ fontFamily: JM, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{DETAIL.listLabel}</span>
            {DETAIL.rows.map((p) => (
              <div key={p.primary} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)" }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: JM, fontSize: 12.5, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.primary}</span>
                <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-muted)", flex: "0 0 auto" }}>{p.meta}</span>
                <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: "var(--c-action)", flex: "0 0 auto", minWidth: 46, textAlign: "right" }}>{p.share}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", padding: "10px 13px", background: "var(--c-soft)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-action)" }}>→ In your plan · {DETAIL.plan}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", cursor: "pointer" }}>See channel plan →</span>
          </div>
        </div>
      </div>
    </section>
  );
}
