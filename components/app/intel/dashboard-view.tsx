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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useIntel, IntelShell, fmt, fmtCompact } from "@/components/app/intel/shared";
import type { Supply } from "@/components/app/intel/supply-view";
import { Card, Kpi, KpiRow, Badge, Eyebrow, Donut, Bar, bandFor, EvidenceLink, PALETTE, type Segment } from "@/components/app/intel/kit";

type Gap = Supply["keywords"]["gaps"][number];
type ReferrerItem = NonNullable<Supply["funnel"]["subject"]["backlinks"]>["topQualityReferrers"][number];
type ContentEntity = NonNullable<Supply["content"]>["entities"][number];
type ContentPage = ContentEntity["pages"][number];

const JM = "var(--font-mono)";

// ---------------------------------------------------------------------------
// Keyword-gap "add to plan" chips — POSTs a content action against the
// sibling-owned /api/action route ({ title, category, why } -> { id }).
// Contract: GET /api/action -> { actions: { id; title; category; status }[] }.
// A keyword gap is "in plan" when an action titled exactly `Target “{keyword}”`
// already exists. Failed GET (unauthed) just leaves every chip on "add".
// ---------------------------------------------------------------------------
type ActionCategory = "content" | "outreach" | "seo";

interface ActionPlan {
  isInPlan: (title: string) => boolean;
  isPending: (title: string) => boolean;
  isError: (title: string) => boolean;
  add: (title: string, category: ActionCategory, why?: string) => void;
}

function useActionPlan(): ActionPlan {
  const [inPlan, setInPlan] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [errored, setErrored] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/action");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { actions?: { title: string }[] };
        if (!cancelled) setInPlan(new Set((json.actions ?? []).map((a) => a.title)));
      } catch {
        // Unauthed or failed — leave `inPlan` empty; every chip defaults to "add".
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const add = useCallback((title: string, category: ActionCategory, why?: string) => {
    setInPlan((prev) => new Set(prev).add(title)); // optimistic swap to "in plan"
    setPending((prev) => new Set(prev).add(title));
    setErrored((prev) => (prev.has(title) ? new Set([...prev].filter((t) => t !== title)) : prev));
    (async () => {
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, category, why }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setInPlan((prev) => new Set([...prev].filter((t) => t !== title))); // revert
        setErrored((prev) => new Set(prev).add(title));
      } finally {
        setPending((prev) => new Set([...prev].filter((t) => t !== title)));
      }
    })();
  }, []);

  return {
    isInPlan: (title) => inPlan.has(title),
    isPending: (title) => pending.has(title),
    isError: (title) => errored.has(title),
    add,
  };
}

const keywordActionTitle = (keyword: string) => `Target “${keyword}”`;
const keywordActionWhy = (gap: Gap) => `${fmtCompact(gap.volume)}/mo keyword gap — ${gap.competitorsRanking} rivals rank`;

/** The chip pair: static "→ in plan" pill once the action exists, else a clickable "＋ add". */
function AddToPlanChip({ title, category, why, plan }: { title: string; category: ActionCategory; why?: string; plan: ActionPlan }) {
  if (plan.isInPlan(title)) return <Badge tone="violet">→ in plan</Badge>;
  const pending = plan.isPending(title);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        disabled={pending}
        onClick={(ev) => { ev.stopPropagation(); plan.add(title, category, why); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-fill)", color: "var(--c-muted)",
          fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)",
          lineHeight: 1.2, whiteSpace: "nowrap", border: "none", cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1,
        }}
      >
        ＋ add
      </button>
      {plan.isError(title) && <span style={{ fontSize: 10.5, color: "var(--c-faint)" }}>couldn&rsquo;t add</span>}
    </span>
  );
}

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
  const plan = useActionPlan();

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

  const topGaps = [...gaps].sort((a, b) => b.opportunity - a.opportunity).slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* F3 — YOU vs. COMPETITORS + THEIR CHANNEL MIX (one interactive component) */}
      <Card title="You vs. top competitors" meta={`#${rank} of ${ranked.length}`} info="Estimated channel mix from public SEO signals (organic ETV, backlinks, branded search). Not measured analytics. Click a competitor to see their mix.">
        <div style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {/* Left: clickable ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Eyebrow color="var(--c-faint)">click to inspect →</Eyebrow>
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

      {/* KEYWORD GAP */}
      <Card title="Keyword gap" info="High-volume terms rivals rank for that you don't. Opportunity = volume × consensus × position quality. Expand a row to see who ranks where.">
        {topGaps.length > 0 ? (
          <>
            <KeywordGapTable gaps={topGaps} plan={plan} />
            <Footer href="/app/supply">See all {gaps.length} keyword gaps →</Footer>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--c-faint)", margin: 0 }}>No keyword gaps surfaced — you rank where your rivals do.</p>
        )}
      </Card>
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

const GAP_COLS = "minmax(0,1fr) 90px 110px 106px";

/** R3 — expandable keyword-gap rows: each row opens to show every rival's position + a link to their winning URL. */
function KeywordGapTable({ gaps, plan }: { gaps: Gap[]; plan: ActionPlan }) {
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: GAP_COLS, gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--c-line)", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)", background: "var(--c-fill)" }}>
        <span>Keyword</span><span>Volume</span><span>Rivals</span><span>Plan</span>
      </div>
      {gaps.map((g, i) => <KeywordGapRow key={g.keyword} gap={g} isLast={i === gaps.length - 1} plan={plan} />)}
    </div>
  );
}

function KeywordGapRow({ gap, isLast, plan }: { gap: Gap; isLast: boolean; plan: ActionPlan }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid var(--c-fill)" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } }}
        style={{ display: "grid", gridTemplateColumns: GAP_COLS, gap: 12, width: "100%", alignItems: "center", padding: "11px 16px", cursor: "pointer" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, fontWeight: 600, color: "var(--c-ink)" }}>
          <span style={{ fontSize: 10, color: "var(--c-faint)", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
          <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gap.keyword}</span>
        </span>
        <span style={{ fontFamily: JM, fontSize: 13, color: "var(--c-muted)" }}>{fmt(gap.volume)}</span>
        <span><Badge tone="amber">{gap.competitorsRanking} rank it</Badge></span>
        <span onClick={(ev) => ev.stopPropagation()}>
          <AddToPlanChip title={keywordActionTitle(gap.keyword)} category="content" why={keywordActionWhy(gap)} plan={plan} />
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 16px 12px 33px" }}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
            {gap.competitors.map((c, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                <span style={{ color: "var(--c-muted)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.domain}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)" }}>#{c.position}</span>
                  <EvidenceLink href={c.url} style={{ fontSize: 11.5 }}>view</EvidenceLink>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
