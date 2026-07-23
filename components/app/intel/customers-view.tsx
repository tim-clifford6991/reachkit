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
  // communities they sit in, and where you can go to work with them"). Ranked by
  // thread volume; each is a specific engage-here plan move.
  const pockets = [...data.community.pockets].sort((a, b) => b.count - a.count).slice(0, 6);
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
          <Card title="Communities to engage" info="The surfaces your buyers already discuss this on — post, answer, and learn there. Add each as a plan move.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pockets.map((p) => (
                <div key={p.surface} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <a
                    href={subUrl(p.surface)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {p.surface}
                  </a>
                  <Badge tone="neutral">{p.platform}</Badge>
                  <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{p.count} thread{p.count === 1 ? "" : "s"}</span>
                  <AddToPlanChip
                    title={`Engage in ${p.surface}`}
                    category="outreach"
                    why={`${p.count} buyer thread${p.count === 1 ? "" : "s"} surfaced in ${p.surface} — post/answer there.`}
                    plan={plan}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </EvidenceDrawerProvider>
  );
}

function WhoYourBuyer({ data }: { data: Demand }) {
  const { icp } = data;
  const primaryJob = icp.jobsToBeDone[0] ?? "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>{icp.whoItsFor}</span>
        <span style={{ color: "var(--c-faint)", fontSize: 15 }}>→</span>
        <span style={{ fontSize: 13.5, color: "var(--c-muted)" }}>trying to</span>
        <span style={{ color: "var(--c-faint)", fontSize: 15 }}>→</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>{primaryJob}</span>
      </div>
      {icp.useCases.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Eyebrow>Use cases</Eyebrow>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {icp.useCases.map((u, i) => (
              <span
                key={i}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--c-ink)",
                  background: "var(--c-fill)",
                  padding: "7px 13px",
                  borderRadius: "var(--radius-full)",
                }}
              >
                {u}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

