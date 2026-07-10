/* @mirrors components/app/intel/customers-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Eyebrow, Badge } from "./IntelKit";

/**
 * CustomersScreen — the `/app/audience/customers` page: a single "Who your buyers
 * are" card with the ICP→JTBD strip, jobs/use-cases chips, demand themes (with
 * volume + intent), where-they-hang-out, and buyer insights (Pains / Loved
 * features / Personas / Buyer language). Composes the shared IntelKit. Mirrors
 * the live customers-view.
 */
export interface CustomersScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";
const intentTone = (i: string) => (i.startsWith("transaction") ? "green" : i.startsWith("commercial") ? "violet" : "neutral") as "green" | "violet" | "neutral";

const THEMES = [
  { theme: "otter alternative", kw: 4, vol: "2.4k", intent: "commercial" },
  { theme: "free meeting notes", kw: 6, vol: "5.1k", intent: "informational" },
  { theme: "ai notetaker for zoom", kw: 3, vol: "1.8k", intent: "transactional" },
];
const POCKETS = [{ name: "r/productivity", threads: 12 }, { name: "Indie Hackers", threads: 8 }, { name: "r/SaaS", threads: 6 }];
const INSIGHTS: { title: string; color: string; items: string[] }[] = [
  { title: "Pains", color: "var(--c-band-invisible)", items: ["Manual note-taking eats my focus", "I forget the follow-ups after a call"] },
  { title: "Loved features", color: "var(--c-band-findable)", items: ["Accurate transcripts", "Auto-sends recap to Slack"] },
  { title: "Personas", color: "var(--c-action)", items: ["Sales-led founders", "Remote team leads"] },
  { title: "Buyer language", color: "var(--c-band-fair)", items: ["“action items”", "“meeting recap”"] },
];

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div style={{ flex: 1, background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: 12, padding: 14 }}><div style={{ fontFamily: JM, fontSize: 10.5, textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", marginTop: 4 }}>{value}</div></div>;
}
function Chips({ title, items }: { title: string; items: string[] }) {
  return <div><Eyebrow>{title}</Eyebrow><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{items.map((i) => <span key={i} style={{ fontSize: 13, background: "var(--c-fill)", color: "var(--c-ink)", borderRadius: 999, padding: "4px 11px" }}>{i}</span>)}</div></div>;
}

export function CustomersScreen() {
  return (
    <AppShell active="audCust" headerTitle="Customers" headerSub="Who your buyer is, what they search, and where they ask." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <Card title="Who your buyers are" meta="AI meeting notetakers">
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 13, color: "var(--c-muted)" }}>Distilled from category search demand, buyer communities, and competitor reviews.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <InfoBox label="ICP" value="Solo founders & small teams who run lots of calls" />
            <span style={{ color: "var(--c-faint)", fontSize: 20 }}>→</span>
            <InfoBox label="Job to be done" value="Never lose an action item from a meeting" />
          </div>
          <Chips title="Jobs to be done" items={["Never lose an action item", "Share recaps without rewatching", "Search past calls by topic"]} />
          <Chips title="Use cases" items={["Sales call recaps", "User interview notes", "Standup summaries"]} />

          <div>
            <Eyebrow>Demand themes</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {THEMES.map((t) => (
                <div key={t.theme} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: 10, padding: "10px 14px" }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 160 }}>{t.theme}</span>
                  <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>{t.kw} keywords</span>
                  <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-muted)" }}>{t.vol}/mo</span>
                  <Badge tone={intentTone(t.intent)}>{t.intent}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>Where they hang out</Eyebrow>
            <div style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "6px 0 10px" }}>Highest-intent threads where buyers raise the problem unprompted.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {POCKETS.map((p) => (
                <div key={p.name} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", marginTop: 2 }}>{p.threads} buyer threads · → in your plan</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>Buyer insights</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 12 }}>
              {INSIGHTS.map((g) => (
                <div key={g.title}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 8 }}>{g.title}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{g.items.map((i) => <div key={i} style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.4 }}>{i}</div>)}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--c-faint)", marginTop: 14 }}>from 4 competitor review pages · <span style={{ color: "var(--c-action)" }}>g2.com ↗</span> <span style={{ color: "var(--c-action)" }}>capterra.com ↗</span></div>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
