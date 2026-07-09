/* @mirrors components/app/intel/customers-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";

/**
 * CustomersScreen — the in-app Audience → Customers view
 * (`/app/audience/customers`): the AppShell chrome wrapping "who your buyers are
 * and where they feel the pain". Mirrors `customers-view.tsx` — the ICP + jobs, the
 * demand themes, "Where they hang out" (real community threads with evidence links),
 * and the buyer-insight quote groups (Pains / Loved / Personas / Buyer language),
 * each honestly labelled or shown as an explicit empty state. Renders fully with no props.
 */
export interface CustomersScreenProps {
  appName?: string;
}

const JM = "var(--font-mono)";

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: "1 1 240px", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: JM, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--c-ink)", fontWeight: 600, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)" }}>{children}</span>;
}
function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((u, i) => <span key={i} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", background: "var(--c-fill)", padding: "7px 13px", borderRadius: "var(--radius-full)" }}>{u}</span>)}
    </div>
  );
}
function QuoteGroup({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      {items.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13.5, color: "var(--c-ink)", lineHeight: 1.5 }}>
          <span style={{ color, fontWeight: 700, fontFamily: "var(--font-display)", flex: "0 0 auto" }}>&ldquo;</span>
          <span>{b}</span>
        </div>
      ))}
    </div>
  );
}

export function CustomersScreen({ appName = "nudgi.ai" }: CustomersScreenProps) {
  return (
    <AppShell
      active="audCust"
      headerTitle="Customers"
      headerSub={`Who your buyer is & where they ask · ${appName}`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", fontFamily: "var(--font-sans)" }}>
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "26px 30px", boxShadow: "var(--elevation-md)", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--c-ink)", margin: 0 }}>Who your buyers are</h3>
            <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-muted)" }}>· AI meeting notetakers</span>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <InfoBox label="ICP" value="Solo founders & small teams running back-to-back calls" />
            <InfoBox label="Job to be done" value="Never lose an action item from a meeting again" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <Eyebrow>Use cases</Eyebrow>
            <Chips items={["Sales call follow-ups", "Standup notes", "User-interview synthesis", "Client recaps"]} />
          </div>

          {/* Demand themes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <Eyebrow>Demand themes</Eyebrow>
            <Chips items={["“otter.ai alternative”", "“meeting notes app”", "“ai transcription accurate”", "“record zoom automatically”"]} />
          </div>

          {/* Where they hang out */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow>Where they hang out</Eyebrow>
            {[
              { surface: "r/productivity", n: 6, quote: "What's the most accurate AI notetaker that isn't Otter?" },
              { surface: "r/SaaS", n: 4, quote: "Otter keeps mangling names on sales calls — alternatives?" },
              { surface: "Indie Hackers", n: 3, quote: "Cheapest transcription that auto-joins Zoom?" },
            ].map((p, i) => (
              <div key={i} style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-ink)" }}>{p.surface}</span>
                  <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>{p.n} buyer threads</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-action)", fontWeight: 600 }}>→ in your plan</span>
                </div>
                <span style={{ fontSize: 12.5, color: "var(--c-muted)", fontStyle: "italic" }}>&ldquo;{p.quote}&rdquo;</span>
              </div>
            ))}
          </div>

          {/* Buyer insights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Eyebrow>Buyer insights</Eyebrow>
            <QuoteGroup label="Pains" items={["Inaccurate on non-native accents", "Pricing jumps hard after the free tier"]} color="var(--c-band-invisible)" />
            <QuoteGroup label="Loved features" items={["Auto-join calendar meetings", "Searchable transcript history"]} color="var(--c-band-findable)" />
            <QuoteGroup label="Personas" items={["Founder-led sales", "UX researchers", "Consultants billing by call"]} color="#3b6fe0" />
            <span style={{ fontSize: 11.5, color: "var(--c-faint)" }}>from 4 competitor review pages</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
