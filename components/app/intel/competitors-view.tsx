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
import Link from "next/link";
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, Badge, bandFor, Expand, EvidenceLink } from "@/components/app/intel/kit";
import type { Supply } from "@/components/app/intel/supply-view";

export function CompetitorsView() {
  const { data, loading, error, stages } = useIntel<Supply>("supply");
  return (
    <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
      {data && <CompetitorsBody data={data} />}
    </IntelShell>
  );
}

type Entity = Supply["funnel"]["subject"] | Supply["funnel"]["competitors"][number];
type Gap = Supply["keywords"]["gaps"][number];
type ContentEntity = NonNullable<Supply["content"]>["entities"][number];
type ContentPage = ContentEntity["pages"][number];
type ReferrerItem = NonNullable<Entity["backlinks"]>["topQualityReferrers"][number];

// ---------------------------------------------------------------------------
// Pillar-health proxy — the Supply payload doesn't carry a per-competitor
// SEO/Content/Outreach breakdown (that granular pillar scoring only runs for
// the scanned subject). We derive three directionally-honest proxies from
// data that IS present on every entity, so the dots reflect real differences
// rather than three copies of the same score:
//   SEO       → the entity's overall score (traffic/backlink driven)
//   Content   → page count in the cohort's content-effectiveness lens,
//               relative to the busiest entity (falls back to score if the
//               `content` layer wasn't gathered)
//   Outreach  → backlink quality share (topQualityReferrers / total sampled)
// ---------------------------------------------------------------------------
interface PillarDot { value: number; color: string }

function pillarDots(entity: Entity, contentPagesByDomain: Map<string, number>, maxContentPages: number): PillarDot[] {
  const seo = entity.score;
  const contentCount = contentPagesByDomain.get(entity.domain);
  const content = contentCount != null && maxContentPages > 0 ? Math.round((contentCount / maxContentPages) * 100) : entity.score;
  const outreach = entity.backlinks && entity.backlinks.sampled >= 3 ? Math.round(entity.backlinks.qualityShare * 100) : entity.score;
  return [seo, content, outreach].map((v) => ({ value: v, color: bandFor(v).color }));
}

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
  const { subject, competitors } = data.funnel;
  const gaps = data.keywords.gaps;
  const [selected, setSelected] = useState(0); // index into `all` — 0 = you

  const contentPagesByDomain = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.content?.entities ?? []) m.set(e.domain, e.pages.length);
    return m;
  }, [data.content]);
  const maxContentPages = useMemo(() => Math.max(0, ...Array.from(contentPagesByDomain.values())), [contentPagesByDomain]);

  const all: (Entity & { isSubject: boolean })[] = useMemo(
    () => [{ ...subject, isSubject: true }, ...competitors.map((c) => ({ ...c, isSubject: false }))],
    [subject, competitors],
  );
  const sel = all[selected] ?? all[0]!;

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

  // Top keywords: for a rival, the gap keywords they actually rank for (their
  // wins); for the subject, the highest-opportunity gaps — keywords rivals
  // rank for that the subject doesn't, i.e. exactly what "not ranking" means.
  // Each row keeps the full Gap object so the row can expand to show every
  // rival's position on that keyword.
  const keywordRows = useMemo<{ gap: Gap; note: string }[]>(() => {
    if (sel.isSubject) {
      return [...gaps].sort((a, b) => b.opportunity - a.opportunity).slice(0, 3).map((g) => ({ gap: g, note: "not ranking" }));
    }
    return gaps
      .map((g) => ({ g, hit: g.competitors.find((c) => c.domain === sel.domain) }))
      .filter((x): x is { g: Gap; hit: NonNullable<Gap["competitors"][number]> } => !!x.hit)
      .sort((a, b) => b.g.volume - a.g.volume)
      .slice(0, 3)
      .map(({ g, hit }) => ({ gap: g, note: `#${hit.position}` }));
  }, [gaps, sel]);

  const referrerItems = (sel.backlinks?.topQualityReferrers ?? []).slice(0, 5);

  // "Their edge → your move": lead with the rival's single strongest gap
  // keyword (highest volume they rank for that the subject doesn't) as the
  // counter-move, falling back to a traffic/backlink framing when no shared
  // gap exists.
  const bestGapHit = !sel.isSubject
    ? gaps
        .map((g) => ({ g, hit: g.competitors.find((c) => c.domain === sel.domain) }))
        .filter((x): x is { g: (typeof gaps)[number]; hit: NonNullable<(typeof gaps)[number]["competitors"][number]> } => !!x.hit)
        .sort((a, b) => b.g.opportunity - a.g.opportunity)[0]
    : undefined;

  const edgeText = sel.isSubject
    ? "Your baseline. Pick a rival above to see what powers their referral engine — and the move that answers it."
    : bestGapHit
      ? `Ranks #${bestGapHit.hit.position} for "${bestGapHit.g.keyword}" (${fmtCompact(bestGapHit.g.volume)}/mo) — a keyword you don't rank for at all.`
      : `Pulls ${fmtCompact(sel.monthlyTraffic)}/mo with ${referrerItems.length ? `referrers like ${referrerItems[0]!.host}` : "a stronger backlink profile"} — worth studying their acquisition mix.`;
  const moveLabel = !sel.isSubject && bestGapHit ? `Counter: target "${bestGapHit.g.keyword}" — in your Content plan` : null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <Card
        title="Competitors"
        info="Pick a rival to see what powers their referral engine — and the move that answers it."
        style={{ flex: "2 1 440px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap", marginTop: -6, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Pick one to inspect</span>
          <PillarLegendItem label="SEO" />
          <PillarLegendItem label="Content" />
          <PillarLegendItem label="Outreach" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)" }}>dot color = pillar health</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {all.map((e, i) => (
            <CompetitorRow key={e.domain} e={e} selected={i === selected} onSelect={() => setSelected(i)} dots={pillarDots(e, contentPagesByDomain, maxContentPages)} />
          ))}
        </div>
      </Card>

      <div
        style={{
          flex: "1 1 280px",
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

        <ReferrerEdgeList label="Top referrers" items={referrerItems} empty="No quality referrers surfaced." />
        <PagesEdgeList label="Top pages" pages={topPages} byCluster={pagesByCluster} totalCount={selEntity?.pages.length ?? 0} empty="No page-level content data surfaced." />
        <KeywordEdgeList label="Top keywords" rows={keywordRows} empty="No keyword-gap data surfaced." />

        <div style={{ borderTop: "1px solid var(--c-tint-orange-line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-band-hard)" }}>Their edge → your move</span>
          <span style={{ fontSize: 13, color: "var(--c-ink)", lineHeight: 1.55 }}>{edgeText}</span>
          {moveLabel && (
            <Link href="/app/plan/content" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--c-action)", textDecoration: "none" }}>
              {moveLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function PillarLegendItem({ label }: { label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-muted)" }}>
      <span style={{ width: 9, height: 9, borderRadius: "var(--radius-full)", background: "var(--c-faint)" }} />
      {label}
    </span>
  );
}

function CompetitorRow({
  e,
  selected,
  onSelect,
  dots,
}: {
  e: Entity & { isSubject: boolean };
  selected: boolean;
  onSelect: () => void;
  dots: PillarDot[];
}) {
  const band = bandFor(e.score);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(); } }}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: "var(--radius-md)",
        border: `1.5px solid ${selected ? "var(--c-action)" : "var(--c-line)"}`,
        background: selected ? "var(--c-soft)" : e.isSubject ? "var(--c-bg2)" : "var(--c-surface)",
        cursor: "pointer",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 700, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {e.domain}
        {e.isSubject && <Badge tone="violet">you · baseline</Badge>}
      </span>
      <span style={{ display: "inline-flex", gap: 5, flexShrink: 0 }}>
        {dots.map((d, i) => <span key={i} style={{ width: 13, height: 13, borderRadius: "var(--radius-full)", background: d.color }} />)}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: band.color, minWidth: 30, textAlign: "right", flexShrink: 0 }}>{e.score}</span>
      {selected && (
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-action)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </div>
  );
}

const EDGE_LABEL_STYLE: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-band-hard)" };
const ELLIPSIS: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** R1 — linked quality referrers: external link + category badge, anchor text as a muted caption. */
function ReferrerEdgeList({ label, items, empty }: { label: string; items: ReferrerItem[]; empty: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={EDGE_LABEL_STYLE}>{label}</span>
      {items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {items.map((r, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <EvidenceLink href={r.url} style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, ...ELLIPSIS }}>{r.host}</EvidenceLink>
                <Badge tone="neutral">{r.category}</Badge>
              </div>
              {r.anchor && <span style={{ fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic", ...ELLIPSIS }}>linked as &ldquo;{r.anchor}&rdquo;</span>}
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 12.5, color: "var(--c-faint)" }}>{empty}</span>
      )}
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

/** R3 — expandable keyword-gap rows: reveals every rival's position + a link to their winning URL. */
function KeywordEdgeList({ label, rows, empty }: { label: string; rows: { gap: Gap; note: string }[]; empty: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={EDGE_LABEL_STYLE}>{label}</span>
      {rows.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {rows.map((r, i) => <KeywordGapRow key={i} gap={r.gap} note={r.note} />)}
        </div>
      ) : (
        <span style={{ fontSize: 12.5, color: "var(--c-faint)" }}>{empty}</span>
      )}
    </div>
  );
}

function KeywordGapRow({ gap, note }: { gap: Gap; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", padding: "2px 0", cursor: "pointer", textAlign: "left", font: "inherit" }}
      >
        <span style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 500, minWidth: 0, ...ELLIPSIS }}>{gap.keyword} · {note}</span>
        <span style={{ fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul style={{ margin: "5px 0 3px", padding: "0 0 0 8px", listStyle: "none", display: "flex", flexDirection: "column", gap: 4, borderLeft: "2px solid var(--c-line)" }}>
          {gap.competitors.map((c, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
              <span style={{ color: "var(--c-muted)", minWidth: 0, ...ELLIPSIS }}>{c.domain}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>#{c.position}</span>
                <EvidenceLink href={c.url} style={{ fontSize: 11 }}>view</EvidenceLink>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
