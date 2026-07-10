/* @mirrors components/app/intel/plan-timeline-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Eyebrow, Badge } from "./IntelKit";

/**
 * PlanScreen — the `/app/plan` page: the summary strip (score + to-do/verifying/
 * verified), the month calendar, the selected-day actions, the rhythm note, and
 * the Verifying / Done lifecycle cards. Composes the shared IntelKit. Mirrors the
 * live plan-timeline-view.
 */
export interface PlanScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)", SG = "var(--font-display)";
const KIND: Record<string, string> = { content: "var(--c-action)", distribution: "var(--c-band-findable)", post: "var(--c-action)" };

// A 5-week July grid; a few days carry action chips; the 9th is "today".
const DAYS: { n: number; chips: string[]; today?: boolean; muted?: boolean }[] = Array.from({ length: 35 }, (_, i) => {
  const n = i - 1; // month starts on Tue
  const inMonth = n >= 1 && n <= 31;
  const chipMap: Record<number, string[]> = { 2: ["post"], 4: ["post", "content"], 9: ["post", "distribution"], 11: ["post"], 16: ["content"], 18: ["post"], 23: ["distribution"], 25: ["post"] };
  return { n: inMonth ? n : 0, chips: chipMap[n] ?? [], today: n === 9, muted: !inMonth };
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return <div><div style={{ fontFamily: JM, fontSize: 10.5, textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 20, color: color ?? "var(--c-ink)" }}>{value}</div></div>;
}

export function PlanScreen() {
  return (
    <AppShell active="actions" headerTitle="Plan" headerSub="Your whole plan on a calendar — what to do today, what's next, and what's already verified." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Summary strip */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 26, color: "var(--c-action)" }}>54</div><Eyebrow>Score</Eyebrow><div style={{ fontFamily: JM, fontSize: 12, color: "var(--c-band-high)" }}>+9 pts</div></div>
            <Stat label="To do" value={4} />
            <Stat label="Verifying" value={1} color="var(--c-band-fair)" />
            <Stat label="Verified" value={6} color="var(--c-band-findable)" />
            <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--c-muted)" }}>+9 pts verified on your score</div>
          </div>
        </Card>

        {/* Calendar */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, margin: 0 }}>July 2026</h2>
            <div style={{ display: "flex", gap: 6 }}><span style={{ cursor: "pointer", color: "var(--c-faint)" }}>‹</span><span style={{ cursor: "pointer", color: "var(--c-faint)" }}>›</span></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {WEEKDAYS.map((w) => <div key={w} style={{ fontFamily: JM, fontSize: 10.5, textTransform: "uppercase", color: "var(--c-faint)", textAlign: "center", paddingBottom: 4 }}>{w}</div>)}
            {DAYS.map((d, i) => (
              <div key={i} style={{ minHeight: 60, border: "1px solid var(--c-line)", borderRadius: 8, padding: 5, background: d.today ? "var(--c-soft)" : "var(--c-surface)", opacity: d.muted ? 0.35 : 1 }}>
                <div style={{ fontFamily: JM, fontSize: 10.5, color: d.today ? "var(--c-action)" : "var(--c-faint)", fontWeight: d.today ? 700 : 400, marginBottom: 3 }}>{d.n || ""}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{d.chips.map((c, j) => <span key={j} style={{ height: 4, borderRadius: 2, background: KIND[c] }} />)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Selected day */}
        <div>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, margin: "0 0 4px" }}>Today</h2>
          <div style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)", marginBottom: 12 }}>2 actions · ~10 min quick + ~1 min focused piece · ← start here</div>
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderLeft: "3px solid var(--c-action)", borderRadius: "var(--radius-xl)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Badge tone="green">distribution</Badge><Badge tone="amber">high priority</Badge><span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>~20 min</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 15.5 }}>Guest post on 3 podcast-tool roundups</div>
            <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: "4px 0 12px" }}>Closes the referral gap vs fathom.video — they pull backlinks from these exact roundups.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-on-dark)", background: "var(--c-action)", border: "none", borderRadius: "var(--radius-lg)", padding: "9px 16px", cursor: "pointer" }}>✍ Draft the pitch</button>
              <button style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-ink)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "9px 16px", cursor: "pointer" }}>Mark done</button>
            </div>
          </div>
        </div>

        <p style={{ fontFamily: JM, fontSize: 12.5, lineHeight: 1.7, color: "var(--c-muted)", margin: 0 }}>The rhythm: a short post every day (10 minutes, angles drawn from your own market), one deep content piece a week, outreach spaced across venues — steady beats spam, for you and for the algorithms. Your roadmap always rolls 30 days ahead; every draft is scrubbed of AI tells and unique to you; you always post it yourself.</p>

        <Card title="Verifying" meta="1 in flight">
          <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>You marked these done — ReachKit is re-checking your live pages to confirm each one actually shipped before it counts toward your score. Click any row for the full detail.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--c-band-fair)", background: "var(--c-tint-amber)", borderRadius: 6, padding: "2px 8px" }}>Verifying</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>Claim G2 + Capterra listings</span>
            <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-band-fair)" }}>+5 predicted</span>
          </div>
        </Card>

        <Card title="Done" meta="6 verified" info="Confirmed live, newest first — with the score movement actually measured at verification.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[["Added FAQ schema to pricing", "+4"], ["Shipped 3 comparison pages", "+6"], ["Published category landing page", "+3"]].map(([t, p]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--c-band-findable)", background: "var(--c-tint-green)", borderRadius: 6, padding: "2px 8px" }}>Verified</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{t}</span>
                <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: "var(--c-band-findable)" }}>{p}</span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: 12.5, color: "var(--c-muted)" }}>
          <span>Backed by your <a href="/app/plan" style={{ color: "var(--c-action)", textDecoration: "none" }}>content</a> and <a href="/app/plan" style={{ color: "var(--c-action)", textDecoration: "none" }}>distribution</a> analyses.</span>
          <a href="/app/progress" style={{ color: "var(--c-action)", textDecoration: "none" }}>Verified wins land on your Progress timeline →</a>
        </div>
      </div>
    </AppShell>
  );
}
