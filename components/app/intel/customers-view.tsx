"use client";

/**
 * Customers view — "who buyers are" for the Audience group. Re-presents the
 * `demand` intel layer (ICP, JTBD, use cases, search demand, communities,
 * buyer insights) in the Claude Design template's Customers layout: one
 * framed card with an ICP→JTBD strip, use-case chips, a two-column
 * demand-themes / where-they-hang-out split, and quoted buyer insights.
 * Built strictly on the intel kit (`--c-*` tokens).
 */
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, Eyebrow, Badge, EvidenceLink, intentTone } from "@/components/app/intel/kit";
import { WhereBuyersAsk } from "@/components/app/intel/demand-view";
import type { Demand, Theme } from "@/components/app/intel/demand-view";
import type { Synthesis } from "@/components/app/intel/synthesis-view";

const SG = "var(--font-display)";
const JM = "var(--font-mono)";

export function CustomersView() {
  const { data, loading, error, stages } = useIntel<Demand>("demand");
  return (
    <div>
      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
        {data && <CustomersBody data={data} />}
      </IntelShell>
    </div>
  );
}

export function CustomersBody({
  data,
  planTargetsOverride,
}: {
  data: Demand;
  /** Fixtures only: hardcode plan targets instead of the live (best-effort)
   * synthesis fetch below, so the "in your plan" pill is visible unauthed. */
  planTargetsOverride?: { target: string; channel: string }[];
}) {
  const { icp, searchDemand, community, buyerInsights } = data;
  const primaryJob = icp.jobsToBeDone[0] ?? "—";
  const themes = searchDemand.themes;

  // Best-effort secondary fetch: cross-links community pockets to the
  // plan. Cheap when warm (server-cached) — but cold, this warms
  // the SAME synthesis cache the Plan pages use, which can mean a full LLM
  // synthesis gather (minutes). Must never block or degrade this view if it's
  // slow, loading, or errors — so we skip IntelShell entirely and just use
  // `data` once it resolves. `enabled: !!data` additionally defers starting
  // this fetch until the (required) demand data above has resolved, so a cold
  // synthesis gather never runs concurrently with the demand gather this view
  // actually needs.
  const { data: synthesis } = useIntel<Synthesis>("synthesis", { enabled: !!data });
  const planTargets =
    planTargetsOverride ?? synthesis?.distributionPlan.map((d) => ({ target: d.target, channel: d.channel }));

  return (
    <Card title="Who your buyers are" meta={data.category}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <span style={{ fontSize: 12.5, color: "var(--c-muted)", marginTop: -8 }}>
          Distilled from category search demand, buyer communities, and competitor reviews.
        </span>

        {/* ICP → primary job */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          <InfoBox label="ICP" value={icp.whoItsFor} />
          <div style={{ display: "flex", alignItems: "center", color: "var(--c-faint)", fontSize: 20 }}>→</div>
          <InfoBox label="Job to be done" value={primaryJob} />
        </div>

        {icp.jobsToBeDone.length > 1 && (
          <ChipSection title="Jobs to be done" items={icp.jobsToBeDone} tone="ink" />
        )}

        <ChipSection title="Use cases" items={icp.useCases} tone="ink" />

        {/* Demand themes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Eyebrow>Demand themes</Eyebrow>
          {themes.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {themes.map((t: Theme, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 500, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.theme}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                    <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>{t.sampleKeywords.length} keyword{t.sampleKeywords.length === 1 ? "" : "s"}</span>
                    <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: "var(--c-ink)" }}>{fmtCompact(t.totalVolume)}/mo</span>
                    <Badge tone={intentTone(t.intent)}>{t.intent || "informational"}</Badge>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Thin search demand.</Empty>
          )}
        </div>

        {/* Where they hang out */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Eyebrow>Where they hang out</Eyebrow>
          <span style={{ fontSize: 12, color: "var(--c-faint)", marginTop: -4 }}>
            Highest-intent threads where buyers raise the problem unprompted.
          </span>
          <WhereBuyersAsk pockets={community.pockets} planTargets={planTargets} />
        </div>

        {/* Buyer insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Eyebrow>Buyer insights</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <QuoteGroup label="Pains" items={buyerInsights.pains} color="var(--c-band-invisible)" />
            <QuoteGroup label="Loved features" items={buyerInsights.lovedFeatures} color="var(--c-band-findable)" />
            <QuoteGroup label="Personas" items={buyerInsights.personas} color="#3b6fe0" />
            <QuoteGroup label="Buyer language" items={buyerInsights.buyerLanguage} color="var(--c-action)" />
          </div>
          {buyerInsights.sources.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 11.5, color: "var(--c-faint)" }}>from {buyerInsights.sources.length} competitor review pages</span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {buyerInsights.sources.map((src, i) => (
                  <EvidenceLink key={i} href={sourceHref(src)} style={{ fontSize: 12 }}>
                    {sourceHost(src)}
                  </EvidenceLink>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: "1 1 240px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: JM, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--c-ink)", fontWeight: 600, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

function ChipSection({ title, items, tone }: { title: string; items: string[]; tone: "ink" }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((u, i) => (
          <span key={i} style={{ fontSize: 13, fontWeight: 600, color: tone === "ink" ? "var(--c-ink)" : "var(--c-action)", background: "var(--c-fill)", padding: "7px 13px", borderRadius: "var(--radius-full)" }}>
            {u}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuoteGroup({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
      {items.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13.5, color: "var(--c-ink)", lineHeight: 1.5 }}>
          <span style={{ color, fontWeight: 700, fontFamily: SG, flex: "0 0 auto" }}>&ldquo;</span>
          <span>{b}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>;
}

/** Sources come as full URLs (see lib/scan/demand/reviews.ts); tolerate a bare host+path too. */
const sourceHref = (src: string) => (/^https?:\/\//i.test(src) ? src : `https://${src}`);
const sourceHost = (src: string) => {
  try {
    return new URL(sourceHref(src)).hostname.replace(/^www\./, "");
  } catch {
    return src;
  }
};
