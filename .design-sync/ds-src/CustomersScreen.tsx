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

// L (2026-07-24): communities carry a buyer-intent level + are ranked by it.
const POCKETS: { surface: string; platform: string; count: number; intent: "High" | "Med" | "Low"; tone: "green" | "violet" | "neutral" }[] = [
  { surface: "r/sales", platform: "reddit", count: 9, intent: "High", tone: "green" },
  { surface: "r/productivity", platform: "reddit", count: 14, intent: "Med", tone: "violet" },
  { surface: "news.ycombinator.com", platform: "hackernews", count: 6, intent: "Med", tone: "violet" },
  { surface: "indiehackers.com", platform: "indiehackers", count: 5, intent: "Low", tone: "neutral" },
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
        {/* Row 1 — where they hang out (lifted to the top, owner 2026-07-27: the
            page's lead answer, so it sits above the buyer profile). */}
        <Card title="Where they hang out" info="Every surfaced buyer thread, ranked by buyer intent; click any dot or row for evidence.">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <IntentRecencyMap />
            <BuyerThreadFeed />
          </div>
        </Card>

        {/* Row 2 — who buyers are */}
        {/* K (2026-07-24): labelled, scannable structure — Audience (de-emphasised
            ICP) + Jobs-to-be-done + Use-case chips — replacing the wordy prose line. */}
        <Card title="Who your buyer is" meta="AI meeting notetakers">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Eyebrow>Audience</Eyebrow>
              <span style={{ fontSize: 13.5, color: "var(--c-muted)", lineHeight: 1.5 }}>Solo founders &amp; small teams who run lots of calls and reject losing action items to messy notes</span>
            </div>
            {[
              ["Jobs to be done", ["Never lose an action item", "Search past calls", "Share recaps fast"]],
              ["Use cases", ["Sales call recaps", "User interview notes", "Standup summaries"]],
            ].map(([label, items]) => (
              <div key={label as string} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <Eyebrow>{label}</Eyebrow>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(items as string[]).map((u) => (
                    <span key={u} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", background: "var(--c-fill)", padding: "7px 13px", borderRadius: "var(--radius-full)" }}>{u}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Row 3 — communities to engage */}
        <Card title="Communities to engage" info="The surfaces your buyers already discuss this on, ranked by buyer intent — post, answer, and learn where the most engaged buyers are. Add each as a plan move.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Eyebrow>Ranked by buyer intent</Eyebrow>
            {POCKETS.map((p) => (
              <div key={p.surface} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.surface}
                </a>
                <Badge tone={p.tone}>{p.intent} intent</Badge>
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
