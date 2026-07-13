"use client";

/**
 * Customers view — "who buyers are" for the Audience group. Rebuilt (WS2) as
 * three analytical rows, every data point wired into the shared
 * `EvidenceDrawer` so keywords, themes, threads, and pains are all
 * click-through-to-evidence:
 *   1. Who your buyer is (compact ICP → JTBD + use-case chips) | Demand
 *      themes (each theme + its sample keywords as drawer-opening chips).
 *   2. Where they hang out — the buyer-intent map + the full thread feed,
 *      ranked by intent (thread dates are unavailable for most surfaces).
 *   3. Top buyer pains — mention-ranked bars with expandable evidence.
 * Built strictly on the intel kit (`--c-*` tokens).
 */
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, Eyebrow, Badge, intentTone } from "@/components/app/intel/kit";
import { normalizePains } from "@/components/app/intel/demand-view";
import type { Demand, Theme } from "@/components/app/intel/demand-view";
import { EvidenceDrawerProvider, useEvidenceDrawer } from "@/components/app/intel/evidence-drawer";
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
const PainBars = dynamic(
  () => import("@/components/app/intel/pain-bars").then((m) => m.PainBars),
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
  return (
    <EvidenceDrawerProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Row 1 — who buyers are + demand themes */}
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>
          <Card title="Who your buyer is" meta={data.category}>
            <WhoYourBuyer data={data} />
          </Card>
          <Card title="Demand themes">
            <DemandThemes data={data} />
          </Card>
        </div>

        {/* Row 2 — where they hang out */}
        <Card title="Where they hang out" info="Every surfaced buyer thread, ranked by buyer intent; click any dot or row for evidence.">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <IntentRecencyMap pockets={data.community.pockets} />
            <BuyerThreadFeed pockets={data.community.pockets} />
          </div>
        </Card>

        {/* Row 3 — top buyer pains */}
        <Card
          title="Top buyer pains"
          meta={
            data.buyerInsights.sources.length > 0
              ? `from ${data.buyerInsights.sources.length} competitor review pages`
              : undefined
          }
        >
          <PainBars pains={normalizePains(data.buyerInsights.pains)} sources={data.buyerInsights.sources} />
        </Card>
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

function DemandThemes({ data }: { data: Demand }) {
  const { open } = useEvidenceDrawer();
  const { searchDemand } = data;
  const themes = searchDemand.themes;

  if (!themes.length) {
    return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>Thin search demand.</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {themes.map((t: Theme, i: number) => {
        const sampleLower = t.sampleKeywords.map((s) => s.toLowerCase());
        const themeKeywords = searchDemand.topKeywords.filter((k) => sampleLower.includes(k.keyword.toLowerCase()));
        const lookup = (kw: string) => {
          const hit = searchDemand.topKeywords.find((k) => k.keyword.toLowerCase() === kw.toLowerCase());
          return { volume: hit?.volume ?? 0, intent: hit?.intent ?? null };
        };
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "11px 14px",
              background: "var(--c-bg2)",
              border: "1px solid var(--c-line)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <button
              type="button"
              onClick={() =>
                open({
                  kind: "theme",
                  theme: t.theme,
                  totalVolume: t.totalVolume,
                  intent: t.intent,
                  keywords: themeKeywords,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                font: "inherit",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 13.5,
                  color: "var(--c-ink)",
                  fontWeight: 500,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.theme}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: "var(--c-ink)" }}>
                  {fmtCompact(t.totalVolume)}/mo
                </span>
                <Badge tone={intentTone(t.intent)}>{t.intent || "informational"}</Badge>
              </span>
            </button>
            {t.sampleKeywords.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {t.sampleKeywords.map((kw, j) => {
                  const { volume, intent } = lookup(kw);
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => open({ kind: "keyword", keyword: kw, volume, intent, theme: t.theme })}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: "var(--c-muted)",
                        background: "var(--c-fill)",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: "var(--radius-full)",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      {kw}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
