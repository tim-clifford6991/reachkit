/**
 * M4 market-analysis report sections (paid). Rendered when `report.market` is
 * present — supersedes the lighter competitive-landscape / channels / creators
 * sections. Four surfaces: competitor profiles, the you-vs-rivals channel matrix,
 * demand pockets, and the distribution plan. Content-as-props; server-rendered.
 */

import type { MarketAnalysis } from "@/lib/scan/gap";
import type { DistributionProfile, ContentChannel } from "@/lib/scan/profile";
import { estimateTrafficMix } from "@/lib/scan/profile";
import type { DemandPocket } from "@/lib/scan/demand/types";
import type { ChannelMatrixRow } from "@/lib/scan/gap";
import { COACH_GUIDES } from "@/lib/scan/distribute/coach";
import { DeepSection } from "./deep-section-shell";
import { DistributeWidget } from "./distribute-widget";

// ── helpers ───────────────────────────────────────────────────────────────────

function cadenceLabel(c: ContentChannel): string {
  if (!c.cadence) return "";
  const { postsLast90, active } = c.cadence;
  return active ? ` · ${postsLast90}/90d` : " · dormant";
}

function activeChannels(p: DistributionProfile): ContentChannel[] {
  return p.channels.filter((c) => (c.cadence ? c.cadence.active : true));
}

const CHANNEL_LABEL: Record<string, string> = {
  blog: "Blog",
  youtube: "YouTube",
  newsletter: "Newsletter",
  devto: "dev.to",
  medium: "Medium",
  github: "GitHub",
  podcast: "Podcast",
};

// ── 1. Competitor profiles ────────────────────────────────────────────────────

function CompetitorCard({ p }: { p: DistributionProfile }) {
  const chans = activeChannels(p);
  const comms = p.communities.filter((c) => c.active).map((c) => (c.source === "hacker_news" ? "HN" : "Reddit"));
  return (
    <div className="rounded-lg px-4 py-3.5" style={{ background: "var(--fill-subtle)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>{p.domain}</p>
        {p.seo ? (
          <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
            {p.seo.organicKeywords.toLocaleString()} kw
            {p.seo.referringDomains != null ? ` · ${p.seo.referringDomains.toLocaleString()} ref` : ""}
            {p.seo.authority != null ? ` · DR ${p.seo.authority}` : ""}
          </span>
        ) : null}
      </div>
      {chans.length > 0 && (
        <p className="mt-1.5 text-xs leading-snug" style={{ color: "var(--color-muted)" }}>
          <span className="font-mono uppercase tracking-wider text-[10px]">Distributes via </span>
          {chans.map((c) => `${CHANNEL_LABEL[c.kind] ?? c.kind}${cadenceLabel(c)}`).join(" · ")}
        </p>
      )}
      {comms.length > 0 && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
          <span className="font-mono uppercase tracking-wider text-[10px]">Active in </span>
          {comms.join(", ")}
        </p>
      )}
      {p.marketplace && p.marketplace.length > 0 && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
          <span className="font-mono uppercase tracking-wider text-[10px]">Listed on </span>
          {p.marketplace.map((m) => MARKETPLACE_LABEL[m.source] ?? m.source).join(", ")}
        </p>
      )}
      <TrafficMixBar p={p} />
    </div>
  );
}

const MARKETPLACE_LABEL: Record<string, string> = {
  product_hunt: "Product Hunt",
  appsumo: "AppSumo",
  betalist: "BetaList",
  g2: "G2",
  capterra: "Capterra",
  alternativeto: "AlternativeTo",
};

/** A slim estimated traffic-source split (organic / referral / social / direct).
 *  Always labelled "est." — DataForSEO gives no real channel split (see
 *  lib/scan/profile/traffic-mix.ts). */
function TrafficMixBar({ p }: { p: DistributionProfile }) {
  const mix = estimateTrafficMix(p);
  if (!mix) return null;
  const segs: Array<{ label: string; pct: number; color: string }> = [
    { label: "Organic", pct: mix.organic, color: "var(--color-accent-400)" },
    { label: "Referral", pct: mix.referral, color: "var(--color-success)" },
    { label: "Social", pct: mix.social, color: "var(--color-warning)" },
    { label: "Direct", pct: mix.direct, color: "var(--color-muted)" },
  ];
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="font-mono uppercase tracking-wider text-[10px]" style={{ color: "var(--color-muted)" }}>
          Traffic mix
        </span>
        <span className="font-mono text-[9px]" style={{ color: "var(--color-muted)" }}>est.</span>
      </div>
      <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
        {segs.map((s) => (
          <div key={s.label} style={{ width: `${Math.round(s.pct * 100)}%`, background: s.color }} />
        ))}
      </div>
      <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
        {segs.map((s) => `${s.label} ${Math.round(s.pct * 100)}%`).join(" · ")}
      </p>
    </div>
  );
}

export function CompetitorProfilesSection({ cohort }: { cohort: MarketAnalysis["cohort"] }) {
  if (cohort.competitors.length === 0) return null;
  return (
    <DeepSection eyebrow="Your closest competitors" title="Who you're up against — and how they distribute">
      <div className="space-y-3">
        {cohort.competitors.map((c) => (
          <CompetitorCard key={c.domain} p={c} />
        ))}
      </div>
    </DeepSection>
  );
}

// ── 2. Channel-presence matrix ────────────────────────────────────────────────

function MatrixRow({ row }: { row: ChannelMatrixRow }) {
  const you = !row.self.present ? "—" : row.self.active ? "active" : "dormant";
  const youColor = !row.self.present
    ? "var(--color-danger)"
    : row.self.active
    ? "var(--color-success)"
    : "var(--color-warning)";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5" style={{ background: "var(--fill-subtle)" }}>
      <span className="text-sm" style={{ color: "var(--color-fg)" }}>{CHANNEL_LABEL[row.kind] ?? row.kind}</span>
      <span className="flex items-center gap-4 font-mono text-xs">
        <span style={{ color: youColor }}>you: {you}</span>
        <span className="tabular-nums" style={{ color: "var(--color-muted)" }}>
          rivals: {row.competitorsActive}/{row.total}
        </span>
      </span>
    </div>
  );
}

export function ChannelMatrixSection({ market }: { market: MarketAnalysis }) {
  const rows = market.gap.channelMatrix.filter((r) => r.self.present || r.competitorsActive > 0);
  if (rows.length === 0) return null;
  return (
    <DeepSection eyebrow="You vs them" title="Where your rivals show up — and where you don't">
      <div className="space-y-2">
        {rows.map((r) => (
          <MatrixRow key={r.kind} row={r} />
        ))}
      </div>
    </DeepSection>
  );
}

// ── 3. Demand pockets ─────────────────────────────────────────────────────────

function PocketCard({
  p,
  productName,
  productDescription,
  productUrl,
}: {
  p: DemandPocket;
  productName: string;
  productDescription?: string;
  productUrl?: string;
}) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: "var(--fill-subtle)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>{p.surface}</p>
        <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
          {p.count} thread{p.count === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {p.topThreads.map((t, i) => (
          <li key={i} className="text-xs leading-snug">
            <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">
              {t.title || t.url}
            </a>
            {t.publishedAt ? (
              <span className="ml-1.5 font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
                {t.publishedAt.slice(0, 10)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {/* One-click handoff: draft a value-first reply to engage this pocket. */}
      <DistributeWidget
        productName={productName}
        productDescription={productDescription}
        angle={`Engage in ${p.surface}: people are describing the problem you solve${p.topThreads[0]?.title ? ` (e.g. "${p.topThreads[0].title}")` : ""}`}
        url={productUrl}
        subreddit={p.subreddit ?? undefined}
        platforms={p.subreddit ? ["reddit", "x"] : ["x", "linkedin"]}
      />
    </div>
  );
}

export function DemandPocketsSection({
  market,
  unlocked = true,
}: {
  market: MarketAnalysis;
  unlocked?: boolean;
}) {
  const pockets = market.gap.demandPockets.slice(0, 6);
  if (pockets.length === 0) return null;
  const productUrl = `https://${market.cohort.self.domain}`;
  // Free teaser: show the pocket headlines (surface + thread count) but not the
  // one-click handoff (the paid execution layer).
  if (!unlocked) {
    return (
      <DeepSection eyebrow="Where your buyers are asking" title="Live conversations describing your problem">
        <div className="space-y-2">
          {pockets.map((p, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 rounded-lg px-4 py-2.5" style={{ background: "var(--fill-subtle)" }}>
              <span className="text-sm" style={{ color: "var(--color-fg)" }}>{p.surface}</span>
              <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
                {p.count} thread{p.count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </DeepSection>
    );
  }
  return (
    <DeepSection eyebrow="Where your buyers are asking" title="Live conversations describing your problem">
      <div className="space-y-3">
        {pockets.map((p, i) => (
          <PocketCard
            key={i}
            p={p}
            productName={market.cohort.product.name}
            productDescription={market.cohort.product.description}
            productUrl={productUrl}
          />
        ))}
      </div>
    </DeepSection>
  );
}

// ── 5. Coach — the platforms with no safe automation path ─────────────────────

export function CoachSection() {
  const guides = [COACH_GUIDES.hackernews, COACH_GUIDES.producthunt];
  return (
    <DeepSection eyebrow="Coached channels" title="High-reward, high-scrutiny — do these by hand">
      <div className="space-y-4">
        {guides.map((g) => (
          <div key={g.label}>
            <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>{g.label}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>{g.intro}</p>
            <ul className="mt-1.5 space-y-1">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs leading-snug" style={{ color: "var(--color-fg)" }}>
                  <span style={{ color: "var(--color-accent-400)" }}>·</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DeepSection>
  );
}

// ── 4. Distribution plan ──────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  channel: "Channel",
  demand: "Demand",
  community: "Community",
  seo: "SEO",
};

export function DistributionPlanSection({ market }: { market: MarketAnalysis }) {
  const items = market.plan.items;
  if (items.length === 0) return null;
  return (
    <DeepSection eyebrow="Your distribution plan" title="What to do next — ranked, with the evidence">
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 rounded-lg px-4 py-3" style={{ background: "var(--fill-subtle)" }}>
            <span className="mt-0.5 font-mono text-sm tabular-nums" style={{ color: "var(--color-accent-400)" }}>
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>{item.title}</p>
                <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  {KIND_LABEL[item.kind] ?? item.kind}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--color-muted)" }}>{item.why}</p>
            </div>
          </li>
        ))}
      </ol>
    </DeepSection>
  );
}

// ── Benchmark — you vs rival median + share-of-voice ──────────────────────────

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function BenchmarkRow({ label, you, rivalMedian }: { label: string; you: number; rivalMedian: number }) {
  const ahead = you >= rivalMedian;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5" style={{ background: "var(--fill-subtle)" }}>
      <span className="text-sm" style={{ color: "var(--color-fg)" }}>{label}</span>
      <span className="flex items-center gap-4 font-mono text-xs tabular-nums">
        <span style={{ color: ahead ? "var(--color-success)" : "var(--color-warning)" }}>
          you: {you.toLocaleString()}
        </span>
        <span style={{ color: "var(--color-muted)" }}>rival median: {rivalMedian.toLocaleString()}</span>
      </span>
    </div>
  );
}

export function MarketBenchmarkSection({ market }: { market: MarketAnalysis }) {
  const { self, competitors } = market.cohort;
  const sov = market.gap.shareOfVoice;

  const rivalKw = competitors.map((c) => c.seo?.organicKeywords).filter((n): n is number => typeof n === "number");
  const rivalRef = competitors.map((c) => c.seo?.referringDomains).filter((n): n is number => typeof n === "number");

  const hasKw = self.seo != null && rivalKw.length > 0;
  const hasRef = self.seo?.referringDomains != null && rivalRef.length > 0;
  if (!hasKw && !hasRef && !sov) return null;

  return (
    <DeepSection eyebrow="How you stack up" title="You vs the rival median">
      <div className="space-y-2">
        {hasKw ? (
          <BenchmarkRow label="Organic keywords" you={self.seo!.organicKeywords} rivalMedian={median(rivalKw)} />
        ) : null}
        {hasRef ? (
          <BenchmarkRow label="Referring domains" you={self.seo!.referringDomains!} rivalMedian={median(rivalRef)} />
        ) : null}
        {sov ? (
          <div className="rounded-lg px-4 py-2.5" style={{ background: "var(--fill-subtle)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: "var(--color-fg)" }}>Share of voice</span>
              <span className="font-mono text-xs tabular-nums" style={{ color: "var(--color-accent-400)" }}>
                {Math.round(sov.selfPct * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(sov.selfPct * 100)}%`, background: "var(--color-accent-400)" }} />
            </div>
            <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
              {sov.selfMentions} of {sov.totalMentions} community mentions across you + {sov.rivals.length} rivals
            </p>
          </div>
        ) : null}
      </div>
    </DeepSection>
  );
}

// ── Recent buzz — news freshness/PR signal (paid) ─────────────────────────────

export function RecentBuzzSection({ market }: { market: MarketAnalysis }) {
  const buzz = market.recentBuzz ?? [];
  if (buzz.length === 0) return null;
  return (
    <DeepSection eyebrow="Recent buzz" title="What's been said about your space lately">
      <ul className="space-y-1.5">
        {buzz.map((b, i) => (
          <li key={i} className="text-xs leading-snug">
            <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">
              {b.title || b.url}
            </a>
            {b.publishedDate ? (
              <span className="ml-1.5 font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
                {b.publishedDate.slice(0, 10)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </DeepSection>
  );
}

// ── Keyword gap — keywords rivals rank for that you don't (paid) ──────────────

export function KeywordGapSection({ market }: { market: MarketAnalysis }) {
  const rows = market.gap.keywordGap;
  if (rows.length === 0) return null;
  return (
    <DeepSection eyebrow="Keyword gap" title="What your rivals rank for that you don't">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.keyword} className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5" style={{ background: "var(--fill-subtle)" }}>
            <span className="min-w-0 truncate text-sm" style={{ color: "var(--color-fg)" }}>{r.keyword}</span>
            <span className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
              <span>{r.volume.toLocaleString()}/mo</span>
              <span>{r.rivalsRanking} rival{r.rivalsRanking === 1 ? "" : "s"}</span>
            </span>
          </div>
        ))}
      </div>
    </DeepSection>
  );
}

/**
 * All market sections in order. `unlocked` (paid) renders the full deep view;
 * the free teaser keeps the proof (competitor profiles, benchmark + SOV, channel
 * matrix, demand-pocket headlines) and drops the execution layer + the ranked
 * distribution plan (which the free payload has already emptied).
 */
export function MarketAnalysisSections({
  market,
  unlocked = true,
}: {
  market: MarketAnalysis;
  unlocked?: boolean;
}) {
  return (
    <>
      <CompetitorProfilesSection cohort={market.cohort} />
      <MarketBenchmarkSection market={market} />
      <ChannelMatrixSection market={market} />
      {unlocked ? <KeywordGapSection market={market} /> : null}
      <DemandPocketsSection market={market} unlocked={unlocked} />
      {unlocked ? <RecentBuzzSection market={market} /> : null}
      <DistributionPlanSection market={market} />
      {unlocked ? <CoachSection /> : null}
    </>
  );
}
