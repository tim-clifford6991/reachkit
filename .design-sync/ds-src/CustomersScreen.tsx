/* @mirrors components/app/intel/customers-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Eyebrow, Badge } from "./IntelKit";
import { IntentRecencyMap } from "./IntentRecencyMap";
import { BuyerThreadFeed } from "./BuyerThreadFeed";
import { PainBars } from "./PainBars";

/**
 * CustomersScreen — the `/app/audience/customers` page, rebuilt (WS2) as three
 * analytical rows, every data point wired into the shared EvidenceDrawer:
 *   1. Two columns — "Who your buyer is" (compact ICP→JTBD + use-case chips)
 *      | "Demand themes" (each theme = name + volume + intent, with its
 *      sample keywords as chips beneath, all click-through-to-evidence).
 *   2. Full-width "Where they hang out" — the intent×recency map over the
 *      filterable buyer-thread feed.
 *   3. Full-width "Top buyer pains" — mention-ranked frequency bars.
 * Composes the shared IntelKit + the three new atomic mirrors
 * (IntentRecencyMap, BuyerThreadFeed, PainBars); EvidenceDrawer is the
 * click-through target and is shown as its own standalone card in the DS,
 * not re-embedded here. Mirrors the live `customers-view.tsx`.
 */
export interface CustomersScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";
const intentTone = (i: string) => (i.startsWith("transaction") ? "green" : i.startsWith("commercial") ? "violet" : "neutral") as "green" | "violet" | "neutral";

const THEMES: { theme: string; vol: string; intent: string; keywords: { kw: string; vol: string; intent: string }[] }[] = [
  {
    theme: "otter alternative",
    vol: "2.4k",
    intent: "commercial",
    keywords: [
      { kw: "otter.ai alternative", vol: "1.1k", intent: "commercial" },
      { kw: "best otter alternative", vol: "780", intent: "commercial" },
      { kw: "otter ai vs", vol: "520", intent: "informational" },
    ],
  },
  {
    theme: "free meeting notes",
    vol: "5.1k",
    intent: "informational",
    keywords: [
      { kw: "free meeting notes app", vol: "2.3k", intent: "informational" },
      { kw: "ai meeting notes free", vol: "1.9k", intent: "commercial" },
      { kw: "how to take meeting notes", vol: "900", intent: "informational" },
    ],
  },
  {
    theme: "ai notetaker for zoom",
    vol: "1.8k",
    intent: "transactional",
    keywords: [
      { kw: "zoom ai notetaker", vol: "980", intent: "transactional" },
      { kw: "ai meeting assistant zoom", vol: "560", intent: "commercial" },
    ],
  },
];

const PAINS_META = "from 3 competitor review pages";

export function CustomersScreen() {
  return (
    <AppShell active="audCust" headerTitle="Customers" headerSub="Who your buyer is, what they search, and where they ask." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Row 1 — who buyers are + demand themes */}
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>
          <Card title="Who your buyer is" meta="AI meeting notetakers">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>Solo founders & small teams who run lots of calls</span>
                <span style={{ color: "var(--c-faint)", fontSize: 15 }}>→</span>
                <span style={{ fontSize: 13.5, color: "var(--c-muted)" }}>trying to</span>
                <span style={{ color: "var(--c-faint)", fontSize: 15 }}>→</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>never lose an action item from a meeting</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <Eyebrow>Use cases</Eyebrow>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Sales call recaps", "User interview notes", "Standup summaries"].map((u) => (
                    <span key={u} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", background: "var(--c-fill)", padding: "7px 13px", borderRadius: "var(--radius-full)" }}>
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Demand themes">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {THEMES.map((t) => (
                <div
                  key={t.theme}
                  style={{ display: "flex", flexDirection: "column", gap: 8, padding: "11px 14px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)" }}
                >
                  <button
                    type="button"
                    onClick={() => {}}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 500, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.theme}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                      <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: "var(--c-ink)" }}>{t.vol}/mo</span>
                      <Badge tone={intentTone(t.intent)}>{t.intent}</Badge>
                    </span>
                  </button>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.keywords.map((k) => (
                      <button
                        key={k.kw}
                        type="button"
                        onClick={() => {}}
                        style={{ fontSize: 11.5, fontWeight: 500, color: "var(--c-muted)", background: "var(--c-fill)", border: "none", padding: "5px 10px", borderRadius: "var(--radius-full)", cursor: "pointer", font: "inherit" }}
                      >
                        {k.kw}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Row 2 — where they hang out */}
        <Card title="Where they hang out" info="Intent × recency across every surfaced buyer thread; click any dot or row for evidence.">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <IntentRecencyMap />
            <BuyerThreadFeed />
          </div>
        </Card>

        {/* Row 3 — top buyer pains */}
        <Card title="Top buyer pains" meta={PAINS_META}>
          <PainBars />
        </Card>
      </div>
    </AppShell>
  );
}
