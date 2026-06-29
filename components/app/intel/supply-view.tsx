"use client";

/**
 * Supply view — how you and your rivals get found. Built entirely on the intel
 * kit (one consistent --c-* idiom).
 */
import { useMemo, useState } from "react";
import { useIntel, IntelShell, fmt, fmtCompact } from "@/components/app/intel/shared";
import { Card, Kpi, KpiRow, Badge, Eyebrow, Gauge, Donut, HBars, Bar, DataTable, Tabs, Expand, EvidenceLink, bandFor, PALETTE, type Segment } from "@/components/app/intel/kit";

interface Backlinks { topQualityReferrers: { host: string; category: string; url: string }[]; byCategory: Record<string, number>; qualityShare: number; sampled: number }
/** Two-lens supply view — ESTIMATES from public SEO signals, not measured analytics. */
interface TrafficLens {
  sources: { organic: number; paid: number; referral: number; social: number; direct: number; email: number };
  activities: { content: number; seo: number; outreach: number };
  estimated: boolean;
}
interface Entity { domain: string; isSubject?: boolean; monthlyTraffic: number; score: number; band: string; lens?: TrafficLens | null }
interface CompetitorDeep extends Entity { closeness: number; reason: string; backlinks: Backlinks }
interface Channel { host: string; type: string; action: string; competitorsUsing: number }
interface Gap { keyword: string; volume: number; bestPosition: number; competitorsRanking: number; competitors: { domain: string; position: number; url: string }[]; opportunity: number }

/** Content-effectiveness payload (Item 3). */
type ContentType = "guide" | "comparison" | "listicle" | "landing" | "tool" | "blog" | "docs" | "other";
interface ContentPage { url: string; title?: string; contentType: ContentType; cluster: string; keywordCount: number; etv: number; wordCount: number }
interface ContentEntity { domain: string; isSubject: boolean; contentTypeMix: Partial<Record<ContentType, number>>; pages: ContentPage[] }
interface ContentCluster { label: string; totalPages: number; coveredBy: string[] }
interface ContentIntel { subjectDomain: string; entities: ContentEntity[]; clusters: ContentCluster[] }

interface Supply {
  funnel: { subject: Entity & { category: string; backlinks?: Backlinks }; category: string; competitors: CompetitorDeep[]; discoveryChannels: Record<string, number>; channelsMissing: Channel[] };
  keywords: { gaps: Gap[] };
  content?: ContentIntel;
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };

export function SupplyView() {
  const { data, loading, error, stages } = useIntel<Supply>("supply");
  return (
    <div>      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <Body data={data} />}</IntelShell>
    </div>
  );
}

function Body({ data }: { data: Supply }) {
  const { subject, competitors, discoveryChannels, channelsMissing } = data.funnel;
  const gaps = data.keywords.gaps;
  const rivals = competitors.length;
  const all = [{ ...subject, isSubject: true }, ...competitors].sort((a, b) => b.score - a.score);
  const totalTraffic = all.reduce((s, e) => s + e.monthlyTraffic, 0) || 1;
  const sov = (e: Entity) => (e.monthlyTraffic / totalTraffic) * 100;
  const rank = 1 + competitors.filter((c) => c.score > subject.score).length;
  const gapToLeader = Math.round(Math.max(subject.score, ...competitors.map((c) => c.score)) - subject.score);
  const maxOpp = Math.max(1, ...gaps.map((g) => g.opportunity));
  const sBand = bandFor(subject.score);

  const sovSegs: Segment[] = [{ label: "You", value: sov(subject), color: "var(--c-action)" }, ...competitors.map((c, i) => ({ label: c.domain, value: sov(c), color: PALETTE[(i + 1) % PALETTE.length]! }))];
  const channelSegs: Segment[] = Object.entries(discoveryChannels).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length]! }));
  const channelTotal = channelSegs.reduce((s, x) => s + x.value, 0);

  const benchmark = [
    { label: "Score", you: subject.score, rival: median(competitors.map((c) => c.score)), fmt: (n: number) => String(Math.round(n)) },
    { label: "Monthly traffic", you: subject.monthlyTraffic, rival: median(competitors.map((c) => c.monthlyTraffic)), fmt: fmtCompact },
    // Only benchmark backlink quality when the subject has enough links for the
    // % to be meaningful — a brand-new site with 3 links showing "ahead 33%" is noise.
    ...(subject.backlinks && subject.backlinks.sampled >= 10 ? [{ label: "Backlink quality", you: Math.round(subject.backlinks.qualityShare * 100), rival: Math.round(median(competitors.map((c) => c.backlinks.qualityShare * 100))), fmt: (n: number) => `${Math.round(n)}%` }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <KpiRow>
        <Kpi label="Your score" value={subject.score} color={sBand.color} sub={sBand.label} />
        <Kpi label="Cohort rank" value={`#${rank}`} sub={`of ${rivals + 1}`} />
        <Kpi label="Monthly traffic" value={fmtCompact(subject.monthlyTraffic)} sub={`${Math.round(sov(subject))}% share of voice`} />
        <Kpi label="Keyword gaps" value={gaps.length} sub="rivals rank, you don't" />
      </KpiRow>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <Card title="Cohort standing" meta={data.funnel.category}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
            <Gauge score={subject.score} sub={gapToLeader > 0 ? `${gapToLeader} behind leader` : "you lead"} />
            <ul style={{ minWidth: 240, flex: 1, margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
              {all.map((e, i) => <LeaderRow key={e.domain} e={e} i={i} sov={sov(e)} />)}
            </ul>
          </div>
        </Card>
        <Card title="Share of voice" info="Each company's slice of the cohort's total monthly organic traffic.">
          <Donut segments={sovSegs} centerLabel={`${Math.round(sov(subject))}%`} centerSub="you" />
        </Card>
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="You vs. rivals" info="Your value against the median competitor.">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {benchmark.map((b) => {
              const max = Math.max(b.you, b.rival, 1);
              return (
                <div key={b.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}><span style={{ color: "var(--c-muted)" }}>{b.label}</span><Badge tone={b.you >= b.rival ? "green" : "red"}>{b.you >= b.rival ? "ahead" : "behind"}</Badge></div>
                  <Row label="You" v={b.you} max={max} color="var(--c-action)" fmt={b.fmt} />
                  <Row label="Rivals" v={b.rival} max={max} color="var(--c-faint)" fmt={b.fmt} />
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="How rivals get discovered" meta={`${channelTotal} quality referrers`}>
          {channelSegs.length ? <Donut segments={channelSegs} centerLabel={String(channelTotal)} centerSub="links" /> : <Empty>Thin referrer signal.</Empty>}
        </Card>
      </div>

      {subject.lens && <LensSections lens={subject.lens} />}

      <Card title="Channels you're missing" info="Quality channels feeding rivals where you're absent. Longer bar = more rivals use it.">
        <ChannelsMissing channels={channelsMissing} rivals={rivals} />
      </Card>

      <Card title="Keyword gaps" info="Keywords rivals rank for that you don't. Opportunity = volume × consensus × position quality.">
        <KeywordGaps gaps={gaps} rivals={rivals} maxOpp={maxOpp} />
      </Card>

      {data.content && <ContentEngine intel={data.content} subjectDomain={subject.domain} />}
    </div>
  );
}

function Row({ label, v, max, color, fmt }: { label: string; v: number; max: number; color: string; fmt: (n: number) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
      <span style={{ width: 44, flexShrink: 0, fontSize: 11, color: "var(--c-faint)" }}>{label}</span>
      <div style={{ flex: 1 }}><Bar value={v} max={max} color={color} height={6} /></div>
      <span style={{ width: 52, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--c-muted)", textAlign: "right" }}>{fmt(v)}</span>
    </div>
  );
}

function LeaderRow({ e, i, sov }: { e: Entity & { isSubject?: boolean; reason?: string; backlinks?: Backlinks }; i: number; sov: number }) {
  const band = bandFor(e.score);
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: "var(--radius-lg)", background: e.isSubject ? "var(--c-soft)" : "transparent" }}>
      <span style={{ width: 16, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-faint)", flexShrink: 0 }}>{i + 1}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.domain}</span>{e.isSubject && <Badge tone="violet">you</Badge>}</span>
        <span style={{ display: "block", marginTop: 5, height: 4, maxWidth: 170 }}><Bar value={sov} max={100} color={band.color} height={4} /></span>
      </span>
      <span style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: band.color }}>{e.score}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--c-faint)" }}>{fmtCompact(e.monthlyTraffic)}/mo</span>
      </span>
    </div>
  );
  if (e.isSubject || !e.backlinks) return <li>{inner}</li>;
  return (
    <li>
      {inner}
      <div style={{ paddingLeft: 38 }}>
        <Expand label="details">
          <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 8 }}>{e.reason}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {e.backlinks.topQualityReferrers.slice(0, 6).map((r, j) => <li key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><Badge tone="neutral">{r.category}</Badge><EvidenceLink href={r.url}>{r.host}</EvidenceLink></li>)}
            {e.backlinks.topQualityReferrers.length === 0 && <li style={{ fontSize: 12, color: "var(--c-faint)" }}>No quality referrers surfaced.</li>}
          </ul>
        </Expand>
      </div>
    </li>
  );
}

function KeywordGaps({ gaps, rivals, maxOpp }: { gaps: Gap[]; rivals: number; maxOpp: number }) {
  const [sortKey, setSortKey] = useState<"opportunity" | "volume">("opportunity");
  const sorted = useMemo(() => [...gaps].sort((a, b) => (sortKey === "volume" ? b.volume - a.volume : b.opportunity - a.opportunity)), [gaps, sortKey]);
  if (gaps.length === 0) return <Empty>No keyword gaps surfaced.</Empty>;
  const H = ({ k, children, w }: { k?: "opportunity" | "volume"; children: React.ReactNode; w?: string }) => (
    <span style={{ width: w, flexShrink: 0 }}>{k ? <button type="button" onClick={() => setSortKey(k)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: sortKey === k ? "var(--c-ink)" : "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}>{children}{sortKey === k ? " ↓" : ""}</button> : children}</span>
  );
  return (
    <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--c-fill)", borderBottom: "1px solid var(--c-line)", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)" }}>
        <span style={{ flex: 1 }}>Keyword</span><H k="volume" w="80px">Volume</H><H k="opportunity" w="120px">Opportunity</H><span style={{ width: 90, flexShrink: 0 }}>Rivals</span>
      </div>
      {sorted.slice(0, 25).map((g) => (
        <div key={g.keyword} style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-fill)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.keyword}</span>
            <span style={{ width: 80, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--c-muted)" }}>{fmt(g.volume)}</span>
            <span style={{ width: 120, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1 }}><Bar value={(g.opportunity / maxOpp) * 100} height={6} /></span><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>{Math.round((g.opportunity / maxOpp) * 100)}</span></span>
            <span style={{ width: 90, flexShrink: 0 }}>
              <Expand label={`${g.competitorsRanking} of ${rivals}`}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {g.competitors.map((c, i) => <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}><EvidenceLink href={c.url}>{c.domain}</EvidenceLink><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-faint)" }}>#{c.position}</span></li>)}
                </ul>
              </Expand>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ChannelsMissing({ channels, rivals }: { channels: Channel[]; rivals: number }) {
  const rawTypes = useMemo(() => Array.from(new Set(channels.map((c) => c.type))), [channels]);
  const [tab, setTab] = useState(0);
  if (channels.length === 0) return <Empty>No missing channels — you cover what rivals do.</Empty>;
  const tabs = ["All", ...rawTypes.map(cap)];
  const activeType = tab === 0 ? null : rawTypes[tab - 1];
  const filtered = activeType ? channels.filter((c) => c.type === activeType) : channels;
  return (
    <div>
      <div style={{ marginBottom: 14 }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((c) => (
          <div key={c.host} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)" }}>
            <Badge tone="violet">{c.type}</Badge>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.host}</div>
              <div style={{ fontSize: 12, color: "var(--c-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.action}</div>
            </div>
            <div style={{ width: 110, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "var(--c-faint)", textAlign: "right", marginBottom: 4 }}>{c.competitorsUsing}/{rivals} rivals</div>
              <Bar value={c.competitorsUsing} max={rivals} color="#e0b341" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Two-lens sections (Task 2 — Item 2 supply-demand-synthesis plan)
// ---------------------------------------------------------------------------

/** Source label → display name for the donut legend. */
const SOURCE_LABELS: Record<string, string> = {
  organic: "Organic",
  paid: "Paid search",
  referral: "Referral",
  social: "Social",
  direct: "Direct / brand",
  email: "Email / newsletter",
};

/** Source → palette index for consistent colouring across all donut segments. */
const SOURCE_ORDER = ["organic", "paid", "referral", "social", "direct", "email"] as const;

/** Activity label → display name for the HBars chart. */
const ACTIVITY_LABELS: Record<string, string> = {
  content: "Content",
  seo: "SEO",
  outreach: "Outreach",
};

/**
 * Traffic Sources + Growth Activities lens cards.
 * Rendered only when the subject entity carries a `lens` (i.e. post-classify
 * funnel run). Both charts use only kit components and --c-* tokens — no new
 * palette values introduced.
 */
function LensSections({ lens }: { lens: TrafficLens }) {
  // Build Donut segments from sources, skipping any 0-share channels to keep the
  // chart readable.  dominant = the channel with the highest share.
  const sourceSegs: Segment[] = SOURCE_ORDER
    .map((key, i) => ({
      label: SOURCE_LABELS[key] ?? key,
      value: lens.sources[key],
      color: PALETTE[i % PALETTE.length]!,
    }))
    .filter((s) => s.value > 0.001);

  const dominant = SOURCE_ORDER.reduce((best, key) =>
    lens.sources[key] > lens.sources[best] ? key : best,
    SOURCE_ORDER[0],
  );

  // Build HBars data from activities, scaled to 0–100 for bar rendering.
  const actMax = Math.max(lens.activities.content, lens.activities.seo, lens.activities.outreach, 0.001);
  const actData = (["content", "seo", "outreach"] as const).map((key, i) => ({
    label: ACTIVITY_LABELS[key] ?? key,
    value: Math.round((lens.activities[key] / actMax) * 100),
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <Card
        title="Traffic sources"
        info="Estimated channel mix derived from public SEO signals (organic ETV, backlinks, branded search volume). Not measured analytics."
      >
        <div style={{ marginBottom: 10 }}>
          <Eyebrow color="var(--c-faint)">estimated · not measured</Eyebrow>
        </div>
        {sourceSegs.length > 0 ? (
          <Donut
            segments={sourceSegs}
            centerLabel={dominant.charAt(0).toUpperCase() + dominant.slice(1)}
            centerSub="dominant"
          />
        ) : (
          <Empty>No source signal available — run a full funnel to populate.</Empty>
        )}
      </Card>

      <Card
        title="Growth activities"
        info="Relative weight of three growth levers inferred from SEO footprint, content output, and earned referrers. Estimates only."
      >
        <div style={{ marginBottom: 10 }}>
          <Eyebrow color="var(--c-faint)">estimated · not measured</Eyebrow>
        </div>
        <HBars data={actData} format={(n) => `${n}%`} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Engine (Item 3 — content effectiveness)
// ---------------------------------------------------------------------------

/** Display name for each content type. */
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  guide: "Guide",
  comparison: "Comparison",
  listicle: "Listicle",
  landing: "Landing",
  tool: "Tool",
  blog: "Blog",
  docs: "Docs",
  other: "Other",
};

/** Consistent badge tone per content type. */
const CONTENT_TYPE_TONE: Record<ContentType, import("@/components/app/intel/kit").Tone> = {
  guide: "blue",
  comparison: "amber",
  listicle: "orange",
  landing: "violet",
  tool: "green",
  blog: "neutral",
  docs: "neutral",
  other: "neutral",
};

/**
 * "Content engine" section of the Supply view.
 * Three panels:
 *   (a) Content-type mix across the cohort (HBars per type).
 *   (b) Topic-cluster coverage matrix — shows content gaps where competitors
 *       cover a cluster the subject does not.
 *   (c) Top winning pages table (EvidenceLink · type · cluster · keywords · ETV).
 */
function ContentEngine({ intel, subjectDomain }: { intel: ContentIntel; subjectDomain: string }) {
  const { entities, clusters } = intel;
  const allDomains = entities.map((e) => e.domain);
  const subjectEntity = entities.find((e) => e.isSubject || e.domain === subjectDomain);

  // (a) Build HBars data: aggregate content-type counts across the WHOLE cohort.
  const typeTotals: Partial<Record<ContentType, number>> = {};
  for (const entity of entities) {
    for (const [type, count] of Object.entries(entity.contentTypeMix) as [ContentType, number][]) {
      typeTotals[type] = (typeTotals[type] ?? 0) + (count ?? 0);
    }
  }
  const typeBarData = (Object.entries(typeTotals) as [ContentType, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([type, count], i) => ({
      label: CONTENT_TYPE_LABELS[type],
      value: count,
      color: PALETTE[i % PALETTE.length],
    }));

  // (b) Cluster coverage — content gaps = clusters competitors cover, subject doesn't.
  const subjectCoveredClusters = new Set(
    subjectEntity?.pages.map((p) => p.cluster) ?? [],
  );
  const gapClusters = clusters.filter(
    (c) =>
      !subjectCoveredClusters.has(c.label) &&
      c.coveredBy.some((d) => d !== subjectDomain),
  );

  // (c) Top winning pages table — all competitor + subject pages, sorted by ETV.
  const topPages = entities
    .flatMap((e) => e.pages.map((p) => ({ ...p, domain: e.domain, isSubject: e.isSubject })))
    .sort((a, b) => b.etv - a.etv)
    .slice(0, 20);

  if (entities.length === 0 || topPages.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {/* (a) Content-type mix */}
        <Card
          title="Content engine"
          info="Distribution of content types across the cohort's top organic pages."
        >
          <div style={{ marginBottom: 10 }}>
            <Eyebrow color="var(--c-faint)">type mix · whole cohort</Eyebrow>
          </div>
          {typeBarData.length > 0 ? (
            <HBars data={typeBarData} format={(n) => String(n)} />
          ) : (
            <Empty>No content-type signal available.</Empty>
          )}
        </Card>

        {/* (b) Topic-cluster coverage */}
        <Card
          title="Topic coverage gaps"
          info="Clusters where competitors have pages but you don't. Red = gap; green = you cover it."
        >
          <div style={{ marginBottom: 10 }}>
            <Eyebrow color="var(--c-faint)">
              {gapClusters.length > 0 ? `${gapClusters.length} gaps found` : "no gaps — good coverage"}
            </Eyebrow>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {clusters.slice(0, 12).map((cluster) => {
              const subjectCovers = subjectCoveredClusters.has(cluster.label);
              return (
                <div
                  key={cluster.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    border: "1px solid var(--c-line)",
                    borderRadius: "var(--radius-lg)",
                    background: !subjectCovers && cluster.coveredBy.length > 1 ? "var(--c-tint-red)" : "transparent",
                  }}
                >
                  <Badge tone={subjectCovers ? "green" : "red"}>{subjectCovers ? "covered" : "gap"}</Badge>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>
                    {cluster.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>
                    {cluster.coveredBy.filter((d) => d !== subjectDomain).length}/{allDomains.length - 1} rivals
                  </span>
                </div>
              );
            })}
            {clusters.length === 0 && <Empty>No clusters — run a full content gather to populate.</Empty>}
          </div>
        </Card>
      </div>

      {/* (c) Top winning pages table */}
      <Card
        title="Top winning pages"
        info="Highest-ETV organic pages across the cohort. ETV = estimated traffic value from DataForSEO."
      >
        <DataTable
          cols="minmax(0,2fr) 90px minmax(0,1fr) 70px 80px"
          head={["Page", "Type", "Cluster", "Keywords", "ETV"]}
          rows={topPages.map((p) => [
            <EvidenceLink key={p.url} href={p.url} style={{ fontSize: 13, ...(p.isSubject ? { color: "var(--c-action)" } : {}) }}>
              {p.domain}
            </EvidenceLink>,
            <Badge key="type" tone={CONTENT_TYPE_TONE[p.contentType]}>{CONTENT_TYPE_LABELS[p.contentType]}</Badge>,
            <span key="cluster" style={{ fontSize: 12, color: "var(--c-muted)" }}>{p.cluster}</span>,
            <span key="kw" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-faint)" }}>{p.keywordCount}</span>,
            <span key="etv" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-faint)" }}>{fmtCompact(p.etv)}</span>,
          ])}
        />
      </Card>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</div>;
}
