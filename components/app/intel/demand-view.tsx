"use client";

/**
 * Demand view — buyer-anchored intelligence. Built entirely on the intel kit.
 */
import { useMemo, useState } from "react";
import { useIntel, IntelShell, fmt, fmtCompact } from "@/components/app/intel/shared";
import { Card, HeroCard, Eyebrow, Kpi, KpiRow, Badge, Donut, HBars, DataTable, Tabs, EvidenceLink, intentTone, type Segment, type BarDatum, type Tone } from "@/components/app/intel/kit";

interface Theme { theme: string; totalVolume: number; intent: string; sampleKeywords: string[] }
interface Pocket { surface: string; platform: string; count: number; intentSum?: number; topThreads: { title: string; url: string; intent?: number; publishedAt?: string | null; theme: string }[] }
interface Demand {
  category: string;
  icp: { whoItsFor: string; jobsToBeDone: string[]; useCases: string[] };
  searchDemand: { totalAddressableVolume: number; themes: Theme[]; topKeywords: { keyword: string; volume: number; intent: string | null }[] };
  community: { pockets: Pocket[] };
  buyerInsights: { pains: string[]; lovedFeatures: string[]; personas: string[]; buyerLanguage: string[]; sources: string[] };
}

const intentColor = (i: string) => { const v = (i || "").toLowerCase(); return v.startsWith("transaction") ? "#46a758" : v.startsWith("commercial") ? "var(--c-action)" : "var(--c-faint)"; };
const isBottom = (i: string) => { const v = (i || "").toLowerCase(); return v.startsWith("transaction") || v.startsWith("commercial"); };

export function DemandView() {
  const { data, loading, error, stages } = useIntel<Demand>("demand");
  return (
    <div>      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <Body data={data} />}</IntelShell>
    </div>
  );
}

function Body({ data }: { data: Demand }) {
  const { icp, searchDemand, community, buyerInsights } = data;
  const themes = searchDemand.themes;
  const themeTotal = themes.reduce((s, t) => s + t.totalVolume, 0) || 1;
  const bottom = Math.round((themes.filter((t) => isBottom(t.intent)).reduce((s, t) => s + t.totalVolume, 0) / themeTotal) * 100);
  const threads = community.pockets.reduce((s, p) => s + p.count, 0);

  const themeBars: BarDatum[] = themes.map((t) => ({ label: t.theme, value: t.totalVolume, color: intentColor(t.intent) }));
  const intentGroups = themes.reduce<Record<string, number>>((a, t) => { const k = (t.intent || "informational").toLowerCase(); a[k] = (a[k] ?? 0) + t.totalVolume; return a; }, {});
  const intentSegs: Segment[] = Object.entries(intentGroups).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: intentColor(label) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <KpiRow>
        <Kpi label="Addressable searches" value={fmtCompact(searchDemand.totalAddressableVolume)} sub="monthly, category-wide" />
        <Kpi label="Buying intent" value={`${bottom}%`} sub="commercial + transactional" />
        <Kpi label="Demand themes" value={themes.length} sub="distinct buyer needs" />
        <Kpi label="Community threads" value={threads} sub={`across ${community.pockets.length} surfaces`} />
      </KpiRow>

      <HeroCard>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}><Eyebrow color="var(--c-action)">Ideal customer</Eyebrow><span style={{ fontSize: 12, color: "var(--c-faint)" }}>{data.category}</span></div>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--c-ink)", margin: "0 0 12px" }}>{icp.whoItsFor}</p>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <List title="Jobs to be done" items={icp.jobsToBeDone} mark="✓" />
          <List title="Use cases" items={icp.useCases} mark="·" />
        </div>
      </HeroCard>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <Card title="Demand themes" info="Search keywords grouped into buyer needs, sized by monthly volume. Color = intent.">
          {themeBars.length ? <HBars data={themeBars} format={fmtCompact} /> : <Empty>Thin search demand.</Empty>}
        </Card>
        <Card title="Intent mix" info="Share of demand by buyer stage. Bottom-funnel = ready to buy.">
          {intentSegs.length ? <Donut segments={intentSegs} size={108} centerLabel={`${bottom}%`} centerSub="buying" /> : <Empty>—</Empty>}
        </Card>
      </div>

      <Card title="Top keywords" meta={`${searchDemand.topKeywords.length} terms`}>
        <DataTable cols="1fr 90px 130px" head={["Keyword", "Volume", "Intent"]} rows={searchDemand.topKeywords.slice(0, 15).map((k) => [
          <span key="k" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{k.keyword}</span>,
          <span key="v" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--c-muted)" }}>{fmt(k.volume)}</span>,
          <Badge key="i" tone={intentTone(k.intent ?? "")}>{k.intent ?? "informational"}</Badge>,
        ])} />
      </Card>

      <Card title="Where buyers ask" info="Where buyers raise the problem unprompted, across platforms — freshest, highest-intent threads first.">
        <WhereBuyersAsk pockets={community.pockets} />
      </Card>

      <Card title="Buyer insights" meta={`from ${buyerInsights.sources.length} competitor review pages`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Cluster title="Pains" items={buyerInsights.pains} tone="red" />
          <Cluster title="Loved" items={buyerInsights.lovedFeatures} tone="green" />
          <Cluster title="Personas" items={buyerInsights.personas} tone="blue" />
          <Cluster title="Buyer language" items={buyerInsights.buyerLanguage} tone="violet" />
        </div>
      </Card>
    </div>
  );
}

function List({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  return (
    <div>
      <Eyebrow color="var(--c-action)">{title}</Eyebrow>
      <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((x, i) => <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--c-muted)" }}><span style={{ color: "var(--c-action)" }}>{mark}</span>{x}</li>)}
      </ul>
    </div>
  );
}

function Cluster({ title, items, tone }: { title: string; items: string[]; tone: Tone }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)", marginBottom: 7 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{items.length ? items.map((s, i) => <Badge key={i} tone={tone}>{s}</Badge>) : <Empty>None surfaced.</Empty>}</div>
    </div>
  );
}

function relativeDate(iso?: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const subUrl = (surface: string) => (surface.startsWith("r/") ? `https://www.reddit.com/${surface}/` : `https://${surface}`);

function WhereBuyersAsk({ pockets }: { pockets: Pocket[] }) {
  // Classify by the demand signal (theme / buyer pain / problem search) that
  // surfaced each thread — not by platform (it's all Reddit, the high-signal surface).
  const themes = useMemo(() => {
    const set = new Set<string>();
    pockets.forEach((p) => p.topThreads.forEach((t) => t.theme && set.add(t.theme)));
    return Array.from(set);
  }, [pockets]);
  const [tab, setTab] = useState(0);
  if (pockets.length === 0) return <Empty>No community discussions surfaced yet.</Empty>;
  const tabs = ["All", ...themes];
  const active = tab === 0 ? null : themes[tab - 1];
  const filtered = pockets
    .map((p) => (active ? { ...p, topThreads: p.topThreads.filter((t) => t.theme === active) } : p))
    .filter((p) => p.topThreads.length > 0)
    .slice(0, 12);
  return (
    <div>
      {themes.length > 1 && <div style={{ marginBottom: 14 }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {filtered.map((p, i) => {
          const fresh = p.topThreads.map((t) => t.publishedAt).filter(Boolean).sort().reverse()[0];
          const rel = relativeDate(fresh ?? null);
          return (
            <div key={i} style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <a href={subUrl(p.surface)} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--c-ink)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.surface}</a>
                <span style={{ flexShrink: 0, fontSize: 11, color: "var(--c-faint)" }}>{p.topThreads.length} thread{p.topThreads.length === 1 ? "" : "s"}{rel ? ` · ${rel}` : ""}</span>
              </div>
              <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {p.topThreads.slice(0, 4).map((t, j) => (
                  <li key={j} style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                    <EvidenceLink href={t.url}>{t.title}</EvidenceLink>
                    <span style={{ fontSize: 10.5, color: "var(--c-faint)" }}>{relativeDate(t.publishedAt) ? ` · ${relativeDate(t.publishedAt)}` : ""}{!active && t.theme ? ` · ${t.theme}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
