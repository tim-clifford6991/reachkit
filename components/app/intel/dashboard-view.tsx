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
import { useIntel, IntelShell, fmt, fmtCompact } from "@/components/app/intel/shared";
import type { Supply } from "@/components/app/intel/supply-view";
import { Card, Kpi, KpiRow, Badge, Eyebrow, Donut, Bar, bandFor, EvidenceLink, PALETTE, type Segment } from "@/components/app/intel/kit";

type ReferrerItem = NonNullable<Supply["funnel"]["subject"]["backlinks"]>["topQualityReferrers"][number];
type ContentEntity = NonNullable<Supply["content"]>["entities"][number];
type ContentPage = ContentEntity["pages"][number];

const JM = "var(--font-mono)";

/** Traffic-source key → display label + stable palette order (mirrors Supply). */
const SOURCE_LABELS: Record<string, string> = {
  organic: "Organic",
  paid: "Paid search",
  referral: "Referral",
  social: "Social",
  direct: "Direct / brand",
  email: "Email / newsletter",
};
const SOURCE_ORDER = ["organic", "paid", "referral", "social", "direct", "email"] as const;

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

function Blocks({ data }: { data: Supply }) {
  // Defensive: this subtree renders ONLY in the browser (after the async intel
  // fetch), so any throw here bubbles to the GLOBAL error boundary ("We hit an
  // unexpected error") and is invisible to a server curl. A gatherer that resolves
  // with a partial/degraded shape (missing funnel/keywords.gaps) must degrade to
  // an empty state, never crash the whole /app/dashboard.
  const hasSubject = !!data?.funnel?.subject;
  // Safe fallback keeps every `subject.*` access + hook below from throwing when a
  // stale/degraded cache blob is missing the subject; the JSX early-returns an
  // empty notice in that case (after all hooks, so hook order is preserved).
  const subject = data?.funnel?.subject ?? ({ domain: "", score: 0, monthlyTraffic: 0, lens: null, backlinks: null, mix: null } as unknown as (typeof data)["funnel"]["subject"]);
  const competitors = data?.funnel?.competitors ?? [];

  const ranked = [{ ...subject, isSubject: true }, ...competitors].sort((a, b) => b.score - a.score);
  const totalTraffic = ranked.reduce((s, e) => s + e.monthlyTraffic, 0) || 1;
  const sov = Math.round((subject.monthlyTraffic / totalTraffic) * 100);
  const rank = 1 + competitors.filter((c) => c.score > subject.score).length;

  // F3 — one interactive component: the "you vs competitors" list drives the
  // channel breakdown. Click a rival → the channel mix / referrers / KPIs re-render
  // for THEM (all from data already loaded per entity — no new fetch).
  const [selectedDomain, setSelectedDomain] = useState<string>(subject.domain);
  const selected = ranked.find((e) => e.domain === selectedDomain) ?? subject;

  const lens = selected.lens;
  const channelRows = lens
    ? SOURCE_ORDER.map((key, i) => ({ key, label: SOURCE_LABELS[key] ?? key, value: lens.sources[key], color: PALETTE[i % PALETTE.length]! })).filter((s) => s.value > 0.001)
    : [];
  const sourceSegs: Segment[] = channelRows.map(({ label, value, color }) => ({ label, value, color }));
  const dominant = lens ? SOURCE_ORDER.reduce((best, key) => (lens.sources[key] > lens.sources[best] ? key : best), SOURCE_ORDER[0]) : null;

  // Selected-channel drill-down: default to the dominant channel; falls back to
  // "organic" when there's no lens data at all (the drilldown then just won't render).
  // The channel pick PERSISTS across entity switches, so you can compare the same
  // channel (e.g. Organic) across you + each rival.
  const [selectedChannel, setSelectedChannel] = useState<string>(dominant ?? SOURCE_ORDER[0]);
  const selectedContentEntity = data.content?.entities.find((e) => e.domain === selected.domain || (selected.isSubject && e.isSubject));
  const referrers: ReferrerItem[] = selected.backlinks?.topQualityReferrers ?? [];

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

          {/* Right: channel breakdown for the SELECTED entity */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <Eyebrow color="var(--c-action)">{selected.isSubject ? "Your traffic by channel" : `${selected.domain} · traffic by channel`}</Eyebrow>
            </div>
            {sourceSegs.length > 0 && dominant ? (
              <Donut segments={sourceSegs} centerLabel={dominant.charAt(0).toUpperCase() + dominant.slice(1)} centerSub="dominant" />
            ) : (
              <p style={{ fontSize: 13, color: "var(--c-faint)", margin: "4px 0 14px" }}>Channel mix populates after a full funnel run.</p>
            )}
            {channelRows.length > 0 && (
              <ChannelDrilldown
                rows={channelRows}
                selected={selectedChannel}
                onSelect={setSelectedChannel}
                panel={<ChannelPanel channel={selectedChannel} subjectPages={selectedContentEntity?.pages ?? []} referrers={referrers} />}
              />
            )}
            <KpiRow>
              <Kpi label="Est. visits / mo" value={fmtCompact(selected.monthlyTraffic)} />
              {selected.isSubject && <Kpi label="Share of voice" value={`${sov}%`} sub="of cohort traffic" />}
              {typeof selected.mix?.referringDomains === "number" && (
                <Kpi label="Referring domains" value={fmt(selected.mix?.referringDomains ?? 0)} />
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

// ---------------------------------------------------------------------------
// TRAFFIC-BY-CHANNEL DRILL-DOWN — clickable channel rows (selection idiom
// mirrors competitors-view: `--c-soft` background + `--c-action` text) beside
// a detail panel for whichever channel is selected. Every sub-list degrades to
// a muted "no data surfaced yet" line when the underlying payload is thin —
// this card has no fixture route, so it must stay resilient to sparse data.
// ---------------------------------------------------------------------------
const SOCIAL_OR_COMMUNITY = new Set(["social", "community"]);

interface ChannelRow { key: string; label: string; value: number; color: string }

function ChannelDrilldown({ rows, selected, onSelect, panel }: { rows: ChannelRow[]; selected: string; onSelect: (key: string) => void; panel: React.ReactNode }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: "14px 0 18px" }}>
      <div style={{ flex: "1 1 220px", minWidth: 200, display: "flex", flexDirection: "column", gap: 3 }}>
        {rows.map((r) => {
          const on = r.key === selected;
          return (
            <div
              key={r.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(r.key)}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(r.key); } }}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: "var(--radius-md)",
                background: on ? "var(--c-soft)" : "transparent", color: on ? "var(--c-action)" : "var(--c-muted)",
                cursor: "pointer", fontSize: 12.5, fontWeight: on ? 700 : 500,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: r.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
              <span style={{ fontFamily: JM, fontSize: 11.5, color: on ? "var(--c-action)" : "var(--c-faint)", flexShrink: 0 }}>{Math.round((r.value / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: "2 1 240px", minWidth: 220, background: "var(--c-fill)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>{panel}</div>
    </div>
  );
}

function ChannelPanel({ channel, subjectPages, referrers }: { channel: string; subjectPages: ContentPage[]; referrers: ReferrerItem[] }) {
  let title: string;
  let body: React.ReactNode;

  switch (channel) {
    case "organic": {
      title = "Top landing pages";
      const top = [...subjectPages].sort((a, b) => b.etv - a.etv).slice(0, 3);
      body = top.length > 0
        ? <ChannelList items={top.map((p) => ({ key: p.url, href: p.url, label: p.title || p.url, meta: fmtCompact(p.etv) }))} />
        : <NoData />;
      break;
    }
    case "referral": {
      title = "Top referrers";
      const top = referrers.filter((r) => r.category !== "social" && r.category !== "newsletter").slice(0, 3);
      body = top.length > 0
        ? <ChannelList items={top.map((r) => ({ key: r.host, href: r.url, label: r.host, badge: r.category }))} />
        : <NoData />;
      break;
    }
    case "social": {
      title = "Top social & community sources";
      const top = referrers.filter((r) => SOCIAL_OR_COMMUNITY.has(r.category)).slice(0, 3);
      body = top.length > 0
        ? <ChannelList items={top.map((r) => ({ key: r.host, href: r.url, label: r.host, badge: r.category }))} />
        : <NoData />;
      break;
    }
    case "email": {
      title = "Top newsletter sources";
      const top = referrers.filter((r) => r.category === "newsletter").slice(0, 3);
      body = top.length > 0
        ? <ChannelList items={top.map((r) => ({ key: r.host, href: r.url, label: r.host, badge: r.category }))} />
        : <NoData />;
      break;
    }
    case "direct":
      title = "Direct / brand";
      body = <Explainer text="Branded search & direct visits — grows with brand awareness." />;
      break;
    case "paid":
      title = "Paid search";
      body = <Explainer text="Paid share is estimated; no paid keywords tracked yet." />;
      break;
    default:
      title = "Channel detail";
      body = <NoData />;
  }

  const href = channel === "referral" || channel === "social" || channel === "email" ? "/app/plan" : "/app/plan";

  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 9 }}>{body}</div>
      <Footer href={href}>See channel plan →</Footer>
    </div>
  );
}

function ChannelList({ items }: { items: { key: string; href: string; label: string; meta?: string; badge?: string }[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((it) => (
        <li key={it.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
          <EvidenceLink href={it.href} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</EvidenceLink>
          {it.meta && <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)", flexShrink: 0 }}>{it.meta}</span>}
          {it.badge && <Badge tone="neutral">{it.badge}</Badge>}
        </li>
      ))}
    </ul>
  );
}

function NoData() {
  return <p style={{ fontSize: 12.5, color: "var(--c-faint)", margin: 0 }}>No data surfaced yet.</p>;
}

function Explainer({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0 }}>{text}</p>;
}

function Footer({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14, textAlign: "right" }}>
      <Link href={href} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>{children}</Link>
    </div>
  );
}
