/**
 * M4 market-analysis report sections (paid). Rendered when `report.market` is
 * present — supersedes the lighter competitive-landscape / channels / creators
 * sections. Four surfaces: competitor profiles, the you-vs-rivals channel matrix,
 * demand pockets, and the distribution plan. Content-as-props; server-rendered.
 */

import type { MarketAnalysis } from "@/lib/scan/gap";
import type { DistributionProfile, ContentChannel } from "@/lib/scan/profile";
import type { DemandPocket } from "@/lib/scan/demand/types";
import type { ChannelMatrixRow } from "@/lib/scan/gap";
import { DeepSection } from "./deep-section-shell";

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

function PocketCard({ p }: { p: DemandPocket }) {
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
    </div>
  );
}

export function DemandPocketsSection({ market }: { market: MarketAnalysis }) {
  const pockets = market.gap.demandPockets.slice(0, 6);
  if (pockets.length === 0) return null;
  return (
    <DeepSection eyebrow="Where your buyers are asking" title="Live conversations describing your problem">
      <div className="space-y-3">
        {pockets.map((p, i) => (
          <PocketCard key={i} p={p} />
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

/** All four market sections in order — the paid deep view. */
export function MarketAnalysisSections({ market }: { market: MarketAnalysis }) {
  return (
    <>
      <CompetitorProfilesSection cohort={market.cohort} />
      <ChannelMatrixSection market={market} />
      <DemandPocketsSection market={market} />
      <DistributionPlanSection market={market} />
    </>
  );
}
