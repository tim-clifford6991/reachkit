"use client";

/**
 * Customers view — "who buyers are" for the Audience group (contract pillar 3:
 * who your buyers are, which communities they sit in, where you can go to engage).
 *   1. Who your buyer is — compact ICP → JTBD + use-case chips.
 *   2. Where they hang out — the buyer-intent map + the full thread feed, ranked
 *      by intent (click any dot/row for evidence).
 *   3. Communities to engage — the LESSON → move: each surface buyers already
 *      discuss on, as a specific "engage here" plan action.
 * Built strictly on the intel kit (`--c-*` tokens).
 *
 * M3 (2026-07-23): dropped the "Demand themes" keyword surface (the unclassified
 * keyword fork — the ONE keyword surface is the dashboard spine) and "Top buyer
 * pains" (review-derived — cut both tiers per O-7). This page is now purely the
 * ICP + communities contract pillar.
 */
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import { Card, Eyebrow, Badge } from "@/components/app/intel/kit";
import { subUrl } from "@/components/app/intel/demand-view";
import type { Demand } from "@/components/app/intel/demand-view";
import { EvidenceDrawerProvider } from "@/components/app/intel/evidence-drawer";
import { useActionPlan, AddToPlanChip } from "@/components/app/intel/add-to-plan";
import dynamic from "next/dynamic";

// Heavy client-only leaves — dynamic-imported so they leave the initial bundle
// (holds the audience/customers page under its pinned bundle budget).
const IntentRecencyMap = dynamic(
  () => import("@/components/app/intel/intent-recency-map").then((m) => m.IntentRecencyMap),
  { ssr: false, loading: () => <div style={{ height: 200 }} /> }
);
const BuyerThreadFeed = dynamic(
  () => import("@/components/app/intel/buyer-thread-feed").then((m) => m.BuyerThreadFeed),
  { ssr: false, loading: () => <div style={{ height: 120 }} /> }
);

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

export function CustomersBody({ data }: { data: Demand }) {
  const plan = useActionPlan();
  // The communities your buyers already gather in — contract pillar 3 ("which
  // communities they sit in, and where you can go to work with them").
  // L (owner walkthrough 2026-07-24): don't bundle every community as one — rank
  // and LABEL by BUYER INTENT (avg intent per thread), not just thread volume, so
  // high-intent surfaces (where engaged buyers actually are) stand out. Degrade to
  // count-order when there's no intent signal.
  const scored = data.community.pockets.map((p) => {
    const intentTotal = p.intentSum ?? p.topThreads.reduce((s, t) => s + (t.intent ?? 0), 0);
    return { p, avgIntent: p.count > 0 ? intentTotal / p.count : 0 };
  });
  const hasIntent = scored.some((s) => s.avgIntent > 0);
  const maxAvg = Math.max(...scored.map((s) => s.avgIntent), 1e-6);
  const pockets = [...scored]
    .sort((a, b) => (hasIntent ? b.avgIntent - a.avgIntent : b.p.count - a.p.count))
    .slice(0, 6);
  const intentLevel = (ratio: number): { label: string; tone: "green" | "violet" | "neutral" } =>
    ratio > 0.66 ? { label: "High", tone: "green" } : ratio > 0.33 ? { label: "Med", tone: "violet" } : { label: "Low", tone: "neutral" };
  return (
    <EvidenceDrawerProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Row 1 — who buyers are */}
        <Card title="Who your buyer is" meta={data.category}>
          <WhoYourBuyer data={data} />
        </Card>

        {/* Row 2 — where they hang out (the exploratory map + thread feed) */}
        <Card title="Where they hang out" info="Every surfaced buyer thread, ranked by buyer intent; click any dot or row for evidence.">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <IntentRecencyMap pockets={data.community.pockets} />
            <BuyerThreadFeed pockets={data.community.pockets} />
          </div>
        </Card>

        {/* Row 3 — communities to engage: the LESSON → move. Post/answer/learn
            where buyers already are; each adds to the plan (contract pillar 3). */}
        {pockets.length > 0 && (
          <Card title="Communities to engage" info="The surfaces your buyers already discuss this on, ranked by buyer intent — post, answer, and learn where the most engaged buyers are. Add each as a plan move.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hasIntent && <Eyebrow>Ranked by buyer intent</Eyebrow>}
              {pockets.map(({ p, avgIntent }) => {
                const lvl = intentLevel(avgIntent / maxAvg);
                return (
                  <div key={p.surface} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <a
                      href={subUrl(p.surface)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {p.surface}
                    </a>
                    {hasIntent && <Badge tone={lvl.tone} title="Average buyer intent across this surface's threads (transactional/commercial > informational).">{lvl.label} intent</Badge>}
                    <Badge tone="neutral">{p.platform}</Badge>
                    <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{p.count} thread{p.count === 1 ? "" : "s"}</span>
                    <AddToPlanChip
                      title={`Engage in ${p.surface}`}
                      category="outreach"
                      why={`${p.count} buyer thread${p.count === 1 ? "" : "s"} surfaced in ${p.surface}${hasIntent ? ` (${lvl.label.toLowerCase()} buyer intent)` : ""} — post/answer there.`}
                      grounding={{
                        evidence: `${p.count} buyer thread${p.count === 1 ? "" : "s"} in ${p.surface}${hasIntent ? ` · ${lvl.label} buyer intent` : ""}`,
                        pain: data.icp?.whoItsFor,
                        ...(p.topThreads?.[0]?.url ? { sourceThread: { title: p.topThreads[0].title, url: p.topThreads[0].url } } : {}),
                      }}
                      plan={plan}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </EvidenceDrawerProvider>
  );
}

/** A labelled row of value chips — the data-driven idiom for the buyer card
 *  (R-1.8/R-1.9): a named field, its values as scannable chips, never prose. */
function ChipField({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((v, i) => (
          <span key={i} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", background: "var(--c-fill)", padding: "7px 13px", borderRadius: "var(--radius-full)" }}>{v}</span>
        ))}
      </div>
    </div>
  );
}

// K (owner walkthrough 2026-07-24): the buyer card used to lead with a long
// LLM prose sentence ("privacy-focused website owners and developers who reject
// data-selling analytics platforms…") set at header weight — too wordy, too much
// attention. Consolidated into a LABELLED, scannable structure (R-1.8 data-driven
// + R-1.9 every field named): the ICP prose is de-emphasised under an "Audience"
// label, and the buyer's jobs + use cases render as data chips.
function WhoYourBuyer({ data }: { data: Demand }) {
  const { icp } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Eyebrow>Audience</Eyebrow>
        <span style={{ fontSize: 13.5, color: "var(--c-muted)", lineHeight: 1.5 }}>{icp.whoItsFor}</span>
      </div>
      <ChipField label="Jobs to be done" items={icp.jobsToBeDone.slice(0, 4)} />
      <ChipField label="Use cases" items={icp.useCases} />
    </div>
  );
}

