"use client";

/**
 * Competitors view — a focused, selectable ranked list of your cohort with
 * per-pillar health dots, plus a "their edge → your move" panel for whichever
 * rival is selected. Matches the Claude Design template's Audience ▸
 * Competitors section (audRows / audSelName / audSelEdge / audReferrers /
 * audPages / audKeywords), re-presenting the same `supply` layer data the
 * Supply view already fetches — no new data source.
 */
import { useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, Badge, Expand, EvidenceLink } from "@/components/app/intel/kit";
import { useActionPlan, AddToPlanChip } from "@/components/app/intel/add-to-plan";
import type { Supply } from "@/components/app/intel/supply-view";

// Code-split — these two are new to the /app bundle graph (ReferrerRow pulls in
// the Base UI Tooltip via InfoTip) and were pushing every /app route's shared
// chunk over its pinned bundle-budget baseline. Splitting them out of the
// eager entry keeps the matrix + referrer table working exactly the same
// (client components rendered after data loads) without growing First Load JS.
const CompetitorGapMap = dynamic(() => import("@/components/app/intel/competitor-gap-map").then((m) => m.CompetitorGapMap), { ssr: false });
const ReferrerRow = dynamic(() => import("@/components/app/intel/referrer-row").then((m) => m.ReferrerRow), { ssr: false });

export function CompetitorsView() {
  const { data, loading, error, stages } = useIntel<Supply>("supply");
  return (
    <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
      {data && <CompetitorsBody data={data} />}
    </IntelShell>
  );
}

type Entity = Supply["funnel"]["subject"] | Supply["funnel"]["competitors"][number];
type Channel = Supply["funnel"]["channelsMissing"][number];
type ContentEntity = NonNullable<Supply["content"]>["entities"][number];
type ContentPage = ContentEntity["pages"][number];

// Plain-language tooltips for the referrer tags (hover to learn what each means).
const CATEGORY_HELP: Record<string, string> = {
  marketplace: "Marketplace — a software listing/review platform (G2, Capterra, Product Hunt, AppSumo). High-intent discovery surface.",
  software_directory: "Software directory — a categorized listing site where buyers browse tools.",
  blog: "Blog — an editorial/content site that linked to this domain (a mention or review).",
  media: "Media — a news or press outlet.",
  community: "Community — a forum or discussion site (Reddit, Indie Hackers, Hacker News) where the link appeared.",
  social: "Social — a social network link.",
  newsletter: "Newsletter — an email publication that featured this domain.",
  partner: "Partner — an integration or partner site linking back.",
  other: "Other — a link that doesn't fit the main discovery channels.",
};
const categoryTitle = (c: string) => CATEGORY_HELP[c] ?? `Referrer type: ${c}`;
const DR_HELP = "Domain Rating (0–1000) — the referring site's own authority. Higher = a more valuable, harder-to-earn link.";

/** Best-effort path extraction so page lists read like the template's "/templates" rather than a full URL. */
function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/ (home)" : u.pathname;
  } catch {
    return url;
  }
}

export function CompetitorsBody({ data }: { data: Supply }) {
  const { subject, competitors, channelsMissing, channelStrength } = data.funnel;
  const plan = useActionPlan();

  const all: (Entity & { isSubject: boolean })[] = useMemo(
    () => [{ ...subject, isSubject: true }, ...competitors.map((c) => ({ ...c, isSubject: false }))],
    [subject, competitors],
  );
  const [selected, setSelected] = useState(subject.domain);
  const sel = all.find((e) => e.domain === selected) ?? all[0]!;

  // Top pages for the selected entity, from the content-effectiveness lens (if gathered).
  const selEntity = useMemo(() => data.content?.entities.find((e) => e.domain === sel.domain), [data.content, sel.domain]);
  const topPages = useMemo(
    () => (selEntity ? [...selEntity.pages].sort((a, b) => b.etv - a.etv).slice(0, 3) : []),
    [selEntity],
  );
  // Full page set for the "All N pages" drilldown, grouped by cluster and sorted by ETV within each group.
  const pagesByCluster = useMemo(() => {
    if (!selEntity) return [];
    const groups = new Map<string, ContentPage[]>();
    for (const p of selEntity.pages) {
      const arr = groups.get(p.cluster);
      if (arr) arr.push(p);
      else groups.set(p.cluster, [p]);
    }
    return Array.from(groups.entries()).map(([cluster, clusterPages]) => ({
      cluster,
      pages: [...clusterPages].sort((a, b) => b.etv - a.etv),
    }));
  }, [selEntity]);

  // NOTE (M3, 2026-07-23): the per-rival keyword-gap surface was REMOVED here.
  // `data.keywords.gaps` is RAW, unclassified rival keywords (competitor brands,
  // airports, card products — cardpointers' gap is "capital one" 9.1M, "los
  // angeles international airport" 1.5M). Framed as "target this" it was garbage
  // (the SpaceX-"space" class). Classified rival keywords need the Phase-B
  // relevance judge (deferred); the ONE keyword surface is the dashboard spine.
  // This page is now the COMPETITOR LESSONS surface: referrers + channels.

  // Referrer table — the hero: every quality referrer for the selected entity,
  // ranked by platform reach (etv).
  const refs = sel.backlinks?.topQualityReferrers ?? [];
  const maxEtv = Math.max(1, ...refs.map((r) => r.etv ?? 0));
  const sortedRefs = refs.slice().sort((a, b) => (b.etv ?? 0) - (a.etv ?? 0));

  // "Referrers to pursue" — the actionable acquisition gap, noise-filtered to
  // core relevance: quality referrers pointing at the selected rival whose host
  // never links to the subject, excluding "low" relevance matches.
  const subjectRefHosts = new Set((subject.backlinks?.topQualityReferrers ?? []).map((r) => r.host));
  const pursue = !sel.isSubject
    ? refs
        .filter((r) => !subjectRefHosts.has(r.host) && r.relevance !== "low")
        .sort((a, b) => (b.etv ?? 0) - (a.etv ?? 0))
        .slice(0, 8)
    : [];

  // "Their edge → your move": the LESSON framing (M3) — what powers this rival's
  // discovery, in referrer/channel terms (classified, contract pillar 2), never a
  // raw gap keyword. The concrete moves are the channel EdgeMoves + the "referrers
  // to pursue" list below (each an add-to-plan outreach action).
  const edgeText = sel.isSubject
    ? "Your baseline. Pick a rival above to see what powers their referral engine — and the lesson that answers it."
    : `Pulls ${fmtCompact(sel.monthlyTraffic)}/mo with ${sortedRefs.length ? `referrers like ${sortedRefs[0]!.host}` : "a stronger backlink profile"} — study their acquisition mix, then pursue the referrers they have that you don't (below).`;

  // R4 — concrete edge moves: when a rival is selected, prefer the channels
  // they use that the subject doesn't (real, actionable) over the prose framing.
  const edgeMoves: Channel[] = !sel.isSubject ? channelsMissing.slice(0, 3) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* The matrix IS the selector — replaces the old left rail. Column
          headers are clickable; the selected column drives every panel below. */}
      <Card title="Competitors" info="Click a rival column to focus the detail below.">
        <CompetitorGapMap
          entities={all.map((e) => ({ domain: e.domain, isSubject: e.isSubject }))}
          channelStrength={channelStrength ?? {}}
          selected={selected}
          onSelect={setSelected}
        />
      </Card>

      {/* Full-width focused detail for the selected entity — no second nav rail. */}
      <div
        style={{
          background: "var(--c-tint-orange)",
          border: "1px solid var(--c-tint-orange-line)",
          borderRadius: "var(--radius-xl)",
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--c-ink)" }}>
          {sel.isSubject ? `${sel.domain} · you` : sel.domain}
        </span>

        {/* 2D — surface the per-entity footprint we already hold (previously only
            traffic showed): referring domains, organic keywords, branded search,
            top pages. Each stat is shown only when the signal is present. */}
        <EntityStatStrip
          stats={[
            { label: "Est. visits / mo", value: sel.monthlyTraffic > 0 ? fmtCompact(sel.monthlyTraffic) : null },
            { label: "Referring domains", value: sel.mix?.referringDomains ? fmtCompact(sel.mix.referringDomains) : null },
            { label: "Organic keywords", value: sel.mix?.organicKeywords ? fmtCompact(sel.mix.organicKeywords) : null },
            { label: "Branded search", value: (sel.brandedSearchVolume ?? 0) > 0 ? `${fmtCompact(sel.brandedSearchVolume!)}/mo` : null },
            { label: "Top pages", value: (sel.topPagesCount ?? 0) > 0 ? String(sel.topPagesCount) : null },
          ]}
        />

        {/* Referrer table — the hero. */}
        <Card title={`Where ${sel.isSubject ? "you get" : sel.domain + " gets"} found`} style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
          {sortedRefs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {sortedRefs.map((r) => <ReferrerRow key={r.host} r={r} maxEtv={maxEtv} />)}
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--c-faint)" }}>No quality referrers surfaced.</span>
          )}
        </Card>

        {/* F4 — the acquisition gap: quality referrers pointing at this rival that
            never link to you (core relevance only). The concrete outreach targets
            to pursue, each with a real add-to-plan (outreach action) chip. */}
        {pursue.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--c-tint-orange-line)", paddingTop: 14 }}>
            <span style={EDGE_LABEL_STYLE}>The lesson · pursue the referrers they have, you don&apos;t ({pursue.length})</span>
            {pursue.map((r, i) => {
              const title = `Reach out to ${r.host} for a backlink`;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <EvidenceLink href={r.url} style={{ fontSize: 13, fontWeight: 600, minWidth: 0, flex: 1, ...ELLIPSIS }}>{r.host}</EvidenceLink>
                  <Badge tone="neutral" title={categoryTitle(r.category)}>{r.category}</Badge>
                  {typeof r.authority === "number" && r.authority > 0 && (
                    <span title={DR_HELP} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, color: "var(--c-faint)", flexShrink: 0, cursor: "help" }}>DR&nbsp;{r.authority}</span>
                  )}
                  <AddToPlanChip title={title} category="outreach" why={`${sel.domain} has a ${r.category} link from ${r.host} that you don't — pursue it.`} plan={plan} />
                </div>
              );
            })}
          </div>
        )}
        <PagesEdgeList label="Top pages" pages={topPages} byCluster={pagesByCluster} totalCount={selEntity?.pages.length ?? 0} empty="No page-level content data surfaced." />

        <div style={{ borderTop: "1px solid var(--c-tint-orange-line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-band-hard)" }}>Their edge → your move</span>
          {edgeMoves.length > 0 ? (
            <EdgeMoves channels={edgeMoves} />
          ) : (
            <span style={{ fontSize: 13, color: "var(--c-ink)", lineHeight: 1.55 }}>{edgeText}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const EDGE_LABEL_STYLE: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-band-hard)" };
const ELLIPSIS: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** 2D — a compact stat strip for the selected entity's public footprint. Renders
 *  only the stats that have a value (null entries are dropped). */
function EntityStatStrip({ stats }: { stats: Array<{ label: string; value: string | null }> }) {
  const shown = stats.filter((s) => s.value !== null);
  if (shown.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
      {shown.map((s) => (
        <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)" }}>{s.label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", fontFamily: "var(--font-mono)" }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

/** R2 — pages drill-down: top-3 linked pages (title + traffic + cluster chip), plus an
 *  "All N pages" Expand grouped by cluster, sorted by ETV, each page linked out. */
function PagesEdgeList({ label, pages, byCluster, totalCount, empty }: { label: string; pages: ContentPage[]; byCluster: { cluster: string; pages: ContentPage[] }[]; totalCount: number; empty: string }) {
  if (pages.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <span style={EDGE_LABEL_STYLE}>{label}</span>
        <span style={{ fontSize: 12.5, color: "var(--c-faint)" }}>{empty}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={EDGE_LABEL_STYLE}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {pages.map((p, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <EvidenceLink href={p.url} style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, ...ELLIPSIS }}>{p.title || pathOf(p.url)}</EvidenceLink>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--c-faint)", flexShrink: 0 }}>{fmtCompact(p.etv)}</span>
            </div>
            <Badge tone="neutral" style={{ alignSelf: "flex-start" }}>{p.cluster}</Badge>
          </div>
        ))}
      </div>
      {totalCount > 0 && (
        <Expand label={`All ${totalCount} pages`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {byCluster.map(({ cluster, pages: clusterPages }) => (
              <div key={cluster}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)", marginBottom: 5 }}>{cluster}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {clusterPages.map((p, j) => (
                    <li key={j} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                      <EvidenceLink href={p.url} style={{ fontSize: 12.5, minWidth: 0, flex: 1, ...ELLIPSIS }}>{p.title || pathOf(p.url)}</EvidenceLink>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{fmtCompact(p.etv)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Expand>
      )}
    </div>
  );
}

/** R4 — concrete edge moves: up to 3 channels the selected rival uses that the
 *  subject doesn't, rendered as real actions (not prose) with a type Badge. */
function EdgeMoves({ channels }: { channels: Channel[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {channels.map((c, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", flex: 1, minWidth: 0, ...ELLIPSIS }}>{c.action}</span>
            <Badge tone="neutral">{c.type}</Badge>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--c-faint)", ...ELLIPSIS }}>{c.host} · used by {c.competitorsUsing} rival{c.competitorsUsing === 1 ? "" : "s"}</span>
        </div>
      ))}
    </div>
  );
}
