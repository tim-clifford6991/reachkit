/* @mirrors components/app/intel/customers-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Eyebrow, Badge } from "./IntelKit";
import { IntentRecencyMap } from "./IntentRecencyMap";
import { BuyerThreadFeed } from "./BuyerThreadFeed";

/**
 * CustomersScreen — the `/app/audience/customers` page (contract pillar 3: who
 * your buyers are, which communities they sit in, where to engage). Three rows:
 *   1. "Who your buyer is" — compact ICP→JTBD + use-case chips.
 *   2. "Where they hang out" — the buyer-intent map over the filterable
 *      buyer-thread feed, ranked by intent.
 *   3. "Communities to engage" — each surface buyers discuss on, as a specific
 *      "engage here → add to plan" move.
 * M3 (2026-07-23): the "Demand themes" keyword surface (the unclassified keyword
 * fork) and "Top buyer pains" (review-derived, cut both tiers per O-7) were
 * removed to match the live customers-view. Mirrors `customers-view.tsx`.
 */
export interface CustomersScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";

const POCKETS: { surface: string; platform: string; count: number }[] = [
  { surface: "r/productivity", platform: "reddit", count: 14 },
  { surface: "r/sales", platform: "reddit", count: 9 },
  { surface: "news.ycombinator.com", platform: "hackernews", count: 6 },
  { surface: "indiehackers.com", platform: "indiehackers", count: 5 },
];

function AddChip() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-fill)", color: "var(--c-muted)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)", lineHeight: 1.2, whiteSpace: "nowrap", flexShrink: 0 }}>
      ＋ add
    </span>
  );
}

export function CustomersScreen() {
  return (
    <AppShell active="audCust" headerTitle="Customers" headerSub="Who your buyer is, and the communities where you can go engage them." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Row 1 — who buyers are */}
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

        {/* Row 2 — where they hang out */}
        <Card title="Where they hang out" info="Every surfaced buyer thread, ranked by buyer intent; click any dot or row for evidence.">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <IntentRecencyMap />
            <BuyerThreadFeed />
          </div>
        </Card>

        {/* Row 3 — communities to engage */}
        <Card title="Communities to engage" info="The surfaces your buyers already discuss this on — post, answer, and learn there. Add each as a plan move.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {POCKETS.map((p) => (
              <div key={p.surface} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.surface}
                </a>
                <Badge tone="neutral">{p.platform}</Badge>
                <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{p.count} threads</span>
                <AddChip />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
