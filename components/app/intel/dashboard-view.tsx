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

import Link from "next/link";
import { useIntel, IntelShell, fmt, fmtCompact } from "@/components/app/intel/shared";
import type { Supply } from "@/components/app/intel/supply-view";
import { Card, Kpi, KpiRow, Badge, Eyebrow, Donut, Bar, DataTable, bandFor, PALETTE, type Segment } from "@/components/app/intel/kit";

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
  const { subject, competitors } = data.funnel;
  const gaps = data.keywords.gaps;

  const ranked = [{ ...subject, isSubject: true }, ...competitors].sort((a, b) => b.score - a.score);
  const totalTraffic = ranked.reduce((s, e) => s + e.monthlyTraffic, 0) || 1;
  const sov = Math.round((subject.monthlyTraffic / totalTraffic) * 100);
  const rank = 1 + competitors.filter((c) => c.score > subject.score).length;

  const lens = subject.lens;
  const sourceSegs: Segment[] = lens
    ? SOURCE_ORDER.map((key, i) => ({ label: SOURCE_LABELS[key] ?? key, value: lens.sources[key], color: PALETTE[i % PALETTE.length]! })).filter((s) => s.value > 0.001)
    : [];
  const dominant = lens ? SOURCE_ORDER.reduce((best, key) => (lens.sources[key] > lens.sources[best] ? key : best), SOURCE_ORDER[0]) : null;

  const topGaps = [...gaps].sort((a, b) => b.opportunity - a.opportunity).slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {/* YOU vs. TOP COMPETITORS */}
        <Card title="You vs. top competitors" meta={`#${rank} of ${ranked.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ranked.slice(0, 5).map((e) => {
              const band = bandFor(e.score);
              return (
                <div key={e.domain} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: "var(--radius-lg)", background: e.isSubject ? "var(--c-soft)" : "transparent" }}>
                  <span style={{ width: 118, flexShrink: 0, fontSize: 13, fontWeight: e.isSubject ? 700 : 500, color: e.isSubject ? "var(--c-action)" : "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.isSubject ? "You" : e.domain}
                  </span>
                  <div style={{ flex: 1 }}><Bar value={e.score} max={100} color={band.color} height={8} /></div>
                  <span style={{ width: 26, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 13, fontWeight: 700, color: band.color }}>{e.score}</span>
                </div>
              );
            })}
          </div>
          <Footer href="/app/supply">See the full cohort →</Footer>
        </Card>

        {/* TRAFFIC BY CHANNEL */}
        <Card title="Traffic by channel" info="Estimated channel mix from public SEO signals (organic ETV, backlinks, branded search). Not measured analytics.">
          <div style={{ marginBottom: 10 }}><Eyebrow color="var(--c-faint)">estimated · not measured</Eyebrow></div>
          {sourceSegs.length > 0 && dominant ? (
            <Donut segments={sourceSegs} centerLabel={dominant.charAt(0).toUpperCase() + dominant.slice(1)} centerSub="dominant" />
          ) : (
            <p style={{ fontSize: 13, color: "var(--c-faint)", margin: "4px 0 14px" }}>Channel mix populates after a full funnel run.</p>
          )}
          <KpiRow>
            <Kpi label="Est. visits / mo" value={fmtCompact(subject.monthlyTraffic)} />
            <Kpi label="Share of voice" value={`${sov}%`} sub="of cohort traffic" />
          </KpiRow>
        </Card>
      </div>

      {/* KEYWORD GAP */}
      <Card title="Keyword gap" info="High-volume terms rivals rank for that you don't. Opportunity = volume × consensus × position quality.">
        {topGaps.length > 0 ? (
          <>
            <DataTable
              cols="minmax(0,1fr) 90px 110px"
              head={["Keyword", "Volume", "Rivals"]}
              rows={topGaps.map((g) => [
                <span key="k" style={{ fontWeight: 600, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{g.keyword}</span>,
                <span key="v" style={{ fontFamily: JM, fontSize: 13, color: "var(--c-muted)" }}>{fmt(g.volume)}</span>,
                <Badge key="r" tone="amber">{g.competitorsRanking} rank it</Badge>,
              ])}
            />
            <Footer href="/app/supply">See all {gaps.length} keyword gaps →</Footer>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--c-faint)", margin: 0 }}>No keyword gaps surfaced — you rank where your rivals do.</p>
        )}
      </Card>
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
