/* @mirrors components/app/intel/plan-timeline-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card } from "./IntelKit";
import { PlanItemCard } from "./PlanItemCard";

/**
 * PlanScreen — the `/app/plan` page (WS3 redesign): a slim one-line status
 * row (score · N to do · N verifying · N verified +Δ — replacing the old
 * tall summary card), the calendar at the TOP (past days greyed but still
 * clickable), the selected day's TOP 3 actions across impact horizons
 * (Quick win / This week / Compounding — one per horizon, via
 * `PlanItemCard`), a "Generate more actions" control + "Higher-impact only"
 * toggle beneath the day panel, the rhythm note, and the Verifying/Done
 * lifecycle cards. Sample data: a nudgi.ai plan (Reddit reply quick-win,
 * comparison-content "this week", directory listing "compounding").
 * Mirrors the live `PlanTimelineView`/`PlanTimelineBody`.
 */
export interface PlanScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)", SG = "var(--font-display)", PJ = "var(--font-sans)";
const VERIFIED_COLOR = "var(--c-band-findable)", VERIFYING_COLOR = "var(--c-band-fair)";

const KIND_CHIP: Record<string, string> = { content: "var(--c-action)", distribution: "var(--c-band-findable)", post: "#3b6fe0" };

// A July 2026 grid (today = the 13th, a Monday) — a few days carry action
// chips; days before today are past (greyed, still clickable in the live app).
const DAYS: { n: number; chips: string[]; today?: boolean; muted?: boolean }[] = Array.from({ length: 35 }, (_, i) => {
  const n = i - 2; // month starts on Wed
  const inMonth = n >= 1 && n <= 31;
  const chipMap: Record<number, string[]> = { 2: ["post"], 4: ["post", "content"], 9: ["post", "distribution"], 11: ["post"], 13: ["post", "distribution", "content"], 16: ["content"], 18: ["post"], 23: ["distribution"], 25: ["post"] };
  return { n: inMonth ? n : 0, chips: chipMap[n] ?? [], today: n === 13, muted: !inMonth };
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY_N = 13;

function StripStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>
      <span style={{ fontFamily: JM, fontWeight: 700, color: color ?? "var(--c-ink)" }}>{value}</span> {label}
    </span>
  );
}

export function PlanScreen() {
  return (
    <AppShell active="actions" headerTitle="Plan" headerSub="Your whole plan on a calendar — what to do today, what's next, and what's already verified." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Slim status strip — one line, calendar-first: the calendar is the
            main event, this is orientation above it (replaces the old tall
            summary card). */}
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 20,
          padding: "9px 16px", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", background: "var(--c-surface)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: JM, fontSize: 18, fontWeight: 800, lineHeight: 1, color: "var(--c-action)" }}>54</span>
            <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Discoverability</span>
            <span style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 700, color: VERIFIED_COLOR }}>+9 pts</span>
          </span>
          <span aria-hidden style={{ color: "var(--c-line)" }}>·</span>
          <StripStat label="to do" value={4} />
          <StripStat label="verifying" value={1} color={VERIFYING_COLOR} />
          <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>
            <span style={{ fontFamily: JM, fontWeight: 700, color: VERIFIED_COLOR }}>6</span> verified
            <span style={{ marginLeft: 6, fontFamily: JM, fontWeight: 700, color: VERIFIED_COLOR }}>+9 pts</span>
          </span>
        </div>

        {/* The calendar — moved to the TOP: the plan laid out day by day. */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 2px 8px" }}>
            <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0, minWidth: 130 }}>July 2026</h3>
            <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
              <span style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--c-ink)", opacity: 0.4 }}>‹</span>
              <span style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--c-ink)" }}>›</span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
            {WEEKDAYS.map((w) => (
              <span key={w} style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)", padding: "0 4px" }}>{w}</span>
            ))}
            {DAYS.map((d, i) => {
              const isPast = !d.muted && d.n > 0 && d.n < TODAY_N; // in-month, before today — greyed but still clickable
              const isActive = d.today;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  style={{
                    minHeight: 54,
                    border: `1px solid ${isActive ? "var(--c-action)" : "var(--c-line)"}`,
                    borderRadius: "var(--radius-md)",
                    background: isActive ? "var(--c-soft)" : "var(--c-surface)",
                    padding: "4px 5px 5px",
                    opacity: d.muted ? 0.35 : isPast ? 0.5 : 1,
                    cursor: d.n > 0 ? "pointer" : "default",
                    display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
                  }}
                >
                  <span style={{
                    fontFamily: JM, fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                    color: d.today ? "var(--c-on-dark)" : "var(--c-faint)",
                    background: d.today ? "var(--c-action)" : "transparent",
                    borderRadius: "var(--radius-full)", padding: d.today ? "3px 6px" : "3px 0",
                    alignSelf: "flex-start",
                  }}>
                    {d.n || ""}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {d.chips.slice(0, 2).map((c, j) => (
                      <span key={j} style={{ height: 4, borderRadius: 2, background: KIND_CHIP[c] }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day — the headline is always the top 3, one per impact
            horizon (short/medium/long), workable in place. */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 10px" }}>
            <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>Today</h3>
            <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>3 actions · ~26 min quick + ~90 min focused piece</span>
            <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, color: "var(--c-action)" }}>← start here</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PlanItemCard
              kind="distribution"
              horizon="short"
              channel="community"
              title={'Reply on r/SaaS: "Best AI notetaker for Zoom calls?"'}
              why="A live thread naming otter.ai and fireflies.ai by name — a grounded reply linking your comparison page reaches buyers actively deciding right now."
              effortMin={6}
              priority="high"
              openLabel="Open in Reddit →"
              predictedPts="+3 pts"
            />
            <PlanItemCard
              kind="content"
              horizon="medium"
              title="nudgi vs otter.ai: which fits solo founders"
              why="Closes the comparison-content gap vs otter.ai — they rank #2 for 'otter.ai alternative' (1.1k/mo) and you have no comparison page yet."
              effortMin={90}
              priority="high"
              openLabel="Generate draft"
              predictedPts="+6 pts"
            />
            <PlanItemCard
              kind="distribution"
              horizon="long"
              channel="directory"
              title={'List on "Best AI Meeting Assistants 2026"'}
              why="A curated directory fathom.video and otter.ai both appear on — a one-time listing compounds referral traffic every month after."
              effortMin={20}
              priority="medium"
              openLabel="Draft your listing"
              predictedPts="+2 pts"
              from="Referral gap vs fathom.video"
            />
          </div>

          {/* Generate more actions — with the "higher-impact only" toggle */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--c-line)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
            <button
              type="button"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--c-action)", color: "var(--c-on-dark)",
                fontFamily: PJ, fontWeight: 600, fontSize: 12.5, lineHeight: 1,
                padding: "9px 15px", borderRadius: "var(--radius-lg)", border: "none", cursor: "pointer",
              }}
            >
              ✨ Generate more actions for today
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-muted)" }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, border: "1px solid var(--c-line)", display: "inline-block" }} />
              Higher-impact only
            </label>
          </div>
        </section>

        <p style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", margin: 0, lineHeight: 1.6 }}>
          The rhythm: a short post every day (10 minutes, angles drawn from your own market), one deep content piece a
          week, outreach spaced across venues — steady beats spam, for you and for the algorithms. Your roadmap always
          rolls 30 days ahead; every draft is scrubbed of AI tells and unique to you; you always post it yourself.
        </p>

        <Card title="Verifying" meta="1 in flight">
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "0 0 12px" }}>
            You marked these done — ReachKit is re-checking your live pages to confirm each one actually
            shipped before it counts toward your score. Click any row for the full detail.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: VERIFYING_COLOR, background: "var(--c-tint-amber)", borderRadius: 6, padding: "2px 8px" }}>Verifying</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>Claim G2 + Capterra listings</span>
            <span style={{ fontFamily: JM, fontSize: 12, color: VERIFYING_COLOR }}>+5 predicted</span>
          </div>
        </Card>

        <Card title="Done" meta="6 verified" info="Confirmed live, newest first — with the score movement actually measured at verification.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[["Added FAQ schema to pricing", "+4"], ["Shipped 3 comparison pages", "+6"], ["Published category landing page", "+3"]].map(([t, p]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: VERIFIED_COLOR, background: "var(--c-tint-green)", borderRadius: 6, padding: "2px 8px" }}>Verified</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{t}</span>
                <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: VERIFIED_COLOR }}>{p}</span>
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
