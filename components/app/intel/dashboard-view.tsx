"use client";

/**
 * DashboardIntelBlocks — the intel-side, streamed bottom of the Dashboard home:
 * a compact "you vs. top competitors" benchmark, a "traffic by channel" donut +
 * KPI tiles, and a keyword-gap preview. Each block links to its full tab.
 *
 * Reuses the SAME `supply` intel payload the Supply tab consumes (via `useIntel`)
 * — no new API/gatherer. Heavy on first load, cached after, streamed with the
 * shared IntelShell skeleton so the hero above stays instant. Presentational
 * only: it renders the payload, it does not gather.
 */

import { useState } from "react";
import Link from "next/link";
import { useIntel, IntelShell, fmt } from "@/components/app/intel/shared";
import type { Supply } from "@/components/app/intel/supply-view";
import { Card, Kpi, KpiRow, Eyebrow, Bar, bandFor, PALETTE } from "@/components/app/intel/kit";

const JM = "var(--font-mono)";

/**
 * Quality backlink channels → display label. The dashboard's right column shows a
 * per-entity BACKLINK CHANNEL MIX (honest counts of quality backlinks per channel,
 * from `backlinks.byCategory`), R-6.7/R-1.10. This REPLACED the old "traffic by
 * channel" donut, whose shares were a log-normalised blend of backlink COUNTS and
 * a branded-search volume presented as a % of TRAFFIC — existence-as-magnitude,
 * dropped 2026-07-28. There is no measured traffic-by-channel data to show.
 */
const QUALITY_CHANNELS: { key: string; label: string }[] = [
  { key: "marketplace", label: "Marketplaces" },
  { key: "software_directory", label: "Directories" },
  { key: "community", label: "Community" },
  { key: "media", label: "Media & press" },
  { key: "blog", label: "Blogs" },
  { key: "social", label: "Social" },
  { key: "newsletter", label: "Newsletters" },
  { key: "partner", label: "Partners" },
];

export function DashboardIntelBlocks() {
  const { data, loading, error, stages } = useIntel<Supply>("supply");
  return (
    <div style={{ marginTop: 20 }}>
      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
        {data && <Blocks data={data} />}
      </IntelShell>
    </div>
  );
}

export function Blocks({ data }: { data: Supply }) {
  // Defensive: this subtree renders ONLY in the browser (after the async intel
  // fetch), so any throw here bubbles to the GLOBAL error boundary ("We hit an
  // unexpected error") and is invisible to a server curl. A gatherer that resolves
  // with a partial/degraded shape (missing funnel/keywords.gaps) must degrade to
  // an empty state, never crash the whole /app/dashboard.
  const hasSubject = !!data?.funnel?.subject;
  // Safe fallback keeps every `subject.*` access + hook below from throwing when a
  // stale/degraded cache blob is missing the subject; the JSX early-returns an
  // empty notice in that case (after all hooks, so hook order is preserved).
  const subject = data?.funnel?.subject ?? ({ domain: "", score: 0, monthlyTraffic: 0, backlinks: null, mix: null } as unknown as (typeof data)["funnel"]["subject"]);
  const competitors = data?.funnel?.competitors ?? [];

  const ranked = [{ ...subject, isSubject: true }, ...competitors].sort((a, b) => b.score - a.score);
  const rank = 1 + competitors.filter((c) => c.score > subject.score).length;

  // F3 — one interactive component: the "you vs competitors" list drives the
  // backlink channel mix. Click a rival → the mix / KPIs re-render for THEM (all
  // from data already loaded per entity — no new fetch).
  const [selectedDomain, setSelectedDomain] = useState<string>(subject.domain);
  const selected = ranked.find((e) => e.domain === selectedDomain) ?? subject;

  // Backlink channel mix for the SELECTED entity — honest COUNTS of quality
  // backlinks per channel (R-6.7/R-1.10), sorted desc, colour-coded. Replaces the
  // dropped "traffic by channel" donut (existence-as-magnitude).
  const channelMix = QUALITY_CHANNELS
    .map((c, i) => ({ label: c.label, value: selected.backlinks?.byCategory?.[c.key] ?? 0, color: PALETTE[i % PALETTE.length]! }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const maxChannelCount = Math.max(1, ...channelMix.map((c) => c.value));

  // Degraded/partial intel payload (e.g. a stale cache blob missing the subject):
  // render a friendly notice instead of crashing the whole dashboard.
  if (!hasSubject) {
    return (
      <Card title="You vs. top competitors">
        <p style={{ fontSize: 13, color: "var(--c-faint)", margin: 0 }}>
          Competitive intel isn&apos;t ready for this app yet. Re-run the scan or pick your competitors to populate it.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* F3 — YOU vs. COMPETITORS + THEIR CHANNEL MIX (one interactive component) */}
      <Card title="You vs. top competitors" meta={`#${rank} of ${ranked.length}`} info="Footprint strength (0–100): each site's relative search footprint estimated from public SEO signals (organic ETV, backlinks, branded search) — distinct from your Discoverability Score. Click a competitor to see their channel mix. Not measured analytics.">
        {/* Side-by-side: a 1px rule splits the two halves; when the grid wraps to
            one column (narrow) the divider is hidden and the halves stack. */}
        <style>{`
          .rk-vs-grid { display: grid; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
          .rk-vs-grid > .rk-vs-divider { display: none; }
          @media (min-width: 640px) {
            .rk-vs-grid { grid-template-columns: 1fr 1px 1fr; align-items: stretch; }
            .rk-vs-grid > .rk-vs-divider { display: block; background: var(--c-line); }
          }
        `}</style>
        <div className="rk-vs-grid">
          {/* Left: clickable ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* R-1.9: name the metric so the bar/number isn't a loose figure —
                "Footprint strength 0–100", explicitly distinct from the headline
                Discoverability Score (the "what is this 88?" walkthrough finding). */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 9px 2px" }}>
              <Eyebrow color="var(--c-faint)">click to inspect →</Eyebrow>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)", whiteSpace: "nowrap" }}>Footprint&nbsp;/100</span>
            </div>
            {ranked.slice(0, 5).map((e) => {
              const band = bandFor(e.score);
              const on = e.domain === selected.domain;
              return (
                <div
                  key={e.domain}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDomain(e.domain)}
                  onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setSelectedDomain(e.domain); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: "var(--radius-lg)", cursor: "pointer", background: on ? "var(--c-soft)" : "transparent", outline: on ? "1px solid var(--c-line2)" : "none" }}
                >
                  <span style={{ width: 118, flexShrink: 0, fontSize: 13, fontWeight: e.isSubject || on ? 700 : 500, color: on ? "var(--c-action)" : e.isSubject ? "var(--c-action)" : "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.isSubject ? "You" : e.domain}
                  </span>
                  <div style={{ flex: 1 }}><Bar value={e.score} max={100} color={band.color} height={8} /></div>
                  <span style={{ width: 26, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 13, fontWeight: 700, color: band.color }}>{e.score}</span>
                </div>
              );
            })}
            <Footer href="/app/supply">See the full cohort →</Footer>
          </div>

          {/* Vertical divider (side-by-side only — see .rk-vs-grid style above). */}
          <div className="rk-vs-divider" aria-hidden="true" />

          {/* Right: BACKLINK CHANNEL MIX for the SELECTED entity — honest counts,
              never a traffic donut (R-6.7/R-1.10). */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <Eyebrow color="var(--c-action)">{selected.isSubject ? "Your backlink channel mix" : `${selected.domain} · backlink channel mix`}</Eyebrow>
            </div>
            {channelMix.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "4px 0 14px" }}>
                {channelMix.map((c) => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 104, flexShrink: 0, fontSize: 12, color: "var(--c-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                    <div style={{ flex: 1 }}><Bar value={c.value} max={maxChannelCount} color={c.color} height={8} /></div>
                    <span style={{ width: 26, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 12.5, fontWeight: 700, color: "var(--c-muted)" }}>{c.value}</span>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "var(--c-faint)", margin: "2px 0 0" }}>Quality backlinks per channel — where {selected.isSubject ? "you're" : "they're"} placed.</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--c-faint)", margin: "4px 0 14px" }}>Backlink channel mix populates after a full funnel run.</p>
            )}
            <KpiRow>
              {typeof selected.mix?.referringDomains === "number" && (
                <Kpi label="Referring domains" value={fmt(selected.mix?.referringDomains ?? 0)} />
              )}
              {typeof selected.mix?.organicKeywords === "number" && (
                <Kpi label="Organic keywords" value={fmt(selected.mix?.organicKeywords ?? 0)} />
              )}
            </KpiRow>
          </div>
        </div>
      </Card>
      {/* The keyword surface lives ONCE — the persisted "What to rank for" spine
          (WhatToRankFor), rendered server-side above this block from
          report_payload. The metered Pipeline-B keyword-gap table that used to sit
          here was a SECOND keyword model, recomputed on every tab load; it was
          removed in the M1 unify (2026-07-23). Its rival "why" now rides the spine
          from the already-persisted market gap — no second gather. */}
    </div>
  );
}

function Footer({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14, textAlign: "right" }}>
      <Link href={href} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>{children}</Link>
    </div>
  );
}
