"use client";

/**
 * PlanTimelineView — THE plan: one page where the founder sees everything laid
 * out over time, executes every action in place, and watches wins verify into
 * the score.
 *
 * Merges the tracked action queue (server-loaded `actions` board) with the
 * not-yet-tracked synthesis recommendations (content + distribution, loaded
 * through the same intel layer the plan views use), then schedules the open
 * work across weeks with lib/scan/plan-schedule — §11's anti-spam cadence
 * doubling as the calendar. Below the timeline: what's verifying and what's
 * done (with measured points), so "what was done" lives on the same page as
 * "what to do".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card } from "@/components/app/intel/kit";
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import { type EntryDetail } from "@/components/app/intel/plan-entry-card";
import { KIND_STYLE, kindOfAction } from "@/components/app/intel/plan-kind-style";
import {
  buildPlanDaysWithReplies, buildDailyPostAngles, localDateKey, topThreeByHorizon,
  type PlanEntry, type ScheduledDay, type ThreadReplyInput,
} from "@/lib/scan/plan-schedule";
import type { ActionBoard, BoardAction } from "@/lib/scan/action-board";
import type { Synthesis } from "./synthesis-view";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";
const VERIFYING_COLOR = "var(--color-warning)";
const VERIFIED_COLOR = "var(--color-success)";

// Cold-build proof-of-work screen only shows while the very first synthesis
// gather is streaming (`stages.length > 0`) — most page loads never render it
// at all. next/dynamic (ssr:false) keeps its module out of the plan page's
// First Load JS; the sized placeholder below matches its card footprint so
// there's no layout shift while the chunk fetches.
const PlanBuildingHero = dynamic(
  () => import("@/components/app/intel/plan-building").then((m) => m.PlanBuildingHero),
  { ssr: false, loading: () => <PlanBuildingHeroSkeleton /> },
);

// PlanEntryCard is the heaviest below-the-calendar piece (draft/venue/share
// execution UI + its distribute deps). It only renders inside the selected-day
// panel, never above the fold, so next/dynamic (ssr:false) keeps its module and
// transitive imports out of the plan page's First Load JS. The 120px sized
// placeholder matches a collapsed card's footprint so the panel doesn't jump
// while the chunk fetches.
const PlanEntryCard = dynamic(
  () => import("@/components/app/intel/plan-entry-card").then((m) => m.PlanEntryCard),
  { ssr: false, loading: () => <div style={{ height: 120 }} /> },
);

function PlanBuildingHeroSkeleton() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 16px 72px" }}>
      <div style={{ width: "100%", maxWidth: 560, minHeight: 360, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)" }} />
    </div>
  );
}

function fmtPts(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${n > 0 ? "+" : ""}${v} pts`;
}

export interface PlanScore { total: number; delta: number }

export function PlanTimelineView({ board, domain, score, threadReplies }: { board: ActionBoard; domain: string; score?: PlanScore | null; threadReplies?: ThreadReplyInput[] }) {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  // Cold build (stages streaming) → the proof-of-work experience: the founder
  // watches competitors, ICP, demand, and the plan get built, step by step.
  if (loading && stages.length > 0) return <PlanBuildingHero stages={stages} />;
  return (
    <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
      {data && <PlanTimelineBody board={board} synthesis={data} domain={domain || data.domain} score={score} threadReplies={threadReplies} />}
    </IntelShell>
  );
}

export function PlanTimelineBody({ board, synthesis, domain, score, today: todayProp, threadReplies }: { board: ActionBoard; synthesis: Synthesis; domain: string; score?: PlanScore | null; today?: Date; threadReplies?: ThreadReplyInput[] }) {
  // Stable "today" for the lifetime of the view (fixture pages inject one).
  const [today] = useState(() => todayProp ?? new Date());

  // The rolling 30-day plan — one shared builder (also drives the dashboard
  // preview): pace, place on days from today, fill the daily-post habit.
  // `threadReplies` is cache-warm demand data the page loaded alongside the
  // board (never a fresh gather) — optional, so an empty/absent list just
  // means no reply quick-wins this render, never a fabricated one.
  const days: ScheduledDay[] = useMemo(
    () => buildPlanDaysWithReplies({
      board,
      category: synthesis.category,
      content: synthesis.contentPlan,
      distribution: synthesis.distributionPlan,
      today,
      threadReplies,
    }),
    [board, synthesis, today, threadReplies],
  );

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d.entries])), [days]);

  // Full analysis lookup for the detail popups — the old content/distribution
  // pages folded into per-entry modals.
  const detailFor = useMemo(() => {
    const contentByTitle = new Map(synthesis.contentPlan.map((c) => [c.topic, c]));
    const distByTitle = new Map(synthesis.distributionPlan.map((d) => [d.action, d]));
    const upcoming = buildDailyPostAngles({
      category: synthesis.category,
      contentPlan: synthesis.contentPlan,
      distribution: synthesis.distributionPlan,
    }).slice(0, 6).map((a) => a.title);
    return (e: PlanEntry): EntryDetail | undefined => {
      if (e.kind === "post") return { kind: "post", upcoming };
      if (e.kind === "content") {
        const item = contentByTitle.get(e.title);
        return item ? { kind: "content", item } : undefined;
      }
      const item = distByTitle.get(e.title);
      return item ? { kind: "distribution", item } : undefined;
    };
  }, [synthesis]);

  const [selected, setSelected] = useState<string | null>(null);
  // The selected-day panel — tapping a calendar day scrolls it into view on
  // mobile (the calendar now fits one screen, so the day's actions are below
  // the fold). Desktop shows both at once, so no scroll there.
  const dayPanelRef = useRef<HTMLElement>(null);
  const handleSelectDay = useCallback((date: string) => {
    setSelected(date);
    if (typeof window !== "undefined" && window.innerWidth <= 640) {
      // Let the panel re-render for the new day, then bring it into view.
      requestAnimationFrame(() => dayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, []);
  // Default focus: today if it has work, else the first scheduled day. Once the
  // founder explicitly picks a day (including a past day with nothing on it —
  // greyed but clickable), that pick wins outright: `selected` isn't gated on
  // `byDate.has(...)` so an empty day can still become the active panel.
  const todayKey = localDateKey(today);
  const activeDate = selected ?? (byDate.has(todayKey) ? todayKey : days[0]?.date ?? null);
  const activeEntries: PlanEntry[] = activeDate ? byDate.get(activeDate) ?? [] : [];

  // The headline is always the day's top 3 — one per impact horizon
  // (short/medium/long), backfilled when a horizon is empty. Anything left
  // over stays reachable behind a "more" toggle rather than silently dropped.
  const headlineEntries = useMemo(() => topThreeByHorizon(activeEntries), [activeEntries]);
  const extraEntries = useMemo(
    () => { const picked = new Set(headlineEntries.map((e) => e.key)); return activeEntries.filter((e) => !picked.has(e.key)); },
    [activeEntries, headlineEntries],
  );

  const openCount = days.reduce((s, d) => s + d.entries.length, 0);
  const measured = board.done.filter((a) => a.actualDelta !== null);
  const verifiedPts = measured.length > 0 ? measured.reduce((s, a) => s + (a.actualDelta ?? 0), 0) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Slim status strip — one line, calendar-first: the plan itself (the
          calendar) is the main event, this is just orientation above it. */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 20,
        padding: "9px 16px", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", background: "var(--c-surface)",
      }}>
        {score && (
          <>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: JM, fontSize: 18, fontWeight: 800, lineHeight: 1, color: "var(--c-action)" }}>{score.total}</span>
              <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Discoverability</span>
              {score.delta !== 0 && (
                <span style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 700, color: score.delta > 0 ? VERIFIED_COLOR : "var(--color-danger)" }}>
                  {fmtPts(score.delta)}
                </span>
              )}
            </span>
            <span aria-hidden style={{ color: "var(--c-line)" }}>·</span>
          </>
        )}
        <StripStat label="to do" value={openCount} />
        <StripStat label="verifying" value={board.verifying.length} color={board.verifying.length > 0 ? VERIFYING_COLOR : undefined} />
        <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>
          <span style={{ fontFamily: JM, fontWeight: 700, color: board.done.length > 0 ? VERIFIED_COLOR : "var(--c-ink)" }}>{board.done.length}</span> verified
          {verifiedPts !== null && (
            <span style={{ marginLeft: 6, fontFamily: JM, fontWeight: 700, color: verifiedPts >= 0 ? VERIFIED_COLOR : "var(--color-danger)" }}>
              {fmtPts(verifiedPts)}
            </span>
          )}
        </span>
      </div>

      {/* The calendar — the plan laid out day by day, starting today */}
      {days.length === 0 ? (
        <EmptyPlan />
      ) : (
        <>
          <PlanCalendar days={days} today={today} activeDate={activeDate} onSelect={handleSelectDay} />

          {/* The selected day, workable in place */}
          {activeDate && (
            <section ref={dayPanelRef} style={{ scrollMarginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 10px" }}>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>
                  {activeDate === todayKey ? "Today" : dayHeading(activeDate)}
                </h3>
                {activeEntries.length > 0 && (() => {
                  // Split the day's load so a weekly deep piece (content, ~90 min+)
                  // reads as focused work rather than a scary daily obligation
                  // stacked onto the ~10-min daily habit. Most days are just the
                  // quick post; the deep piece lands once a week.
                  const quickMin = activeEntries.filter((e) => e.effortMin < 30).reduce((s, e) => s + e.effortMin, 0);
                  const focusedMin = activeEntries.filter((e) => e.effortMin >= 30).reduce((s, e) => s + e.effortMin, 0);
                  return (
                    <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>
                      {activeEntries.length} {activeEntries.length === 1 ? "action" : "actions"}
                      {focusedMin > 0
                        ? ` · ~${quickMin} min quick${focusedMin ? ` + ~${focusedMin} min focused piece` : ""}`
                        : ` · ~${quickMin} min`}
                    </span>
                  );
                })()}
                {activeDate === todayKey && <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, color: "var(--c-action)" }}>← start here</span>}
              </div>
              {activeEntries.length > 0 ? (
                // Show EVERY scheduled task in ONE list — horizon-diverse top items
                // first, then the rest, no "show N more" collapse. A day's whole plan
                // must be visible at a glance (owner fix 2678e4a, restored 2026-07-28
                // after a mobile-overview change re-hid the tail; the dot-calendar is
                // the overview surface, NOT a collapsed task list). Guard:
                // plan-timeline-view.showall.test.tsx.
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[...headlineEntries, ...extraEntries].map((e) => (
                    <PlanEntryCard key={e.key} entry={e} domain={domain} detail={detailFor(e)} />
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: "20px 16px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-lg)",
                  fontSize: 12.5, color: "var(--c-faint)",
                }}>
                  {activeDate !== null && activeDate < todayKey
                    ? "Nothing was scheduled for this day."
                    : "Nothing scheduled for this day yet."}
                </div>
              )}
              <GenerateMoreControl todayKey={todayKey} />
            </section>
          )}
        </>
      )}

      {days.length > 0 && (
        <p style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", margin: "-6px 2px 0", lineHeight: 1.6 }}>
          The rhythm: a short post every day (10 minutes, angles drawn from your own market), one deep content piece a
          week, outreach spaced across venues — steady beats spam, for you and for the algorithms. Your roadmap always
          rolls 30 days ahead; every draft is scrubbed of AI tells and unique to you; you always post it yourself.
        </p>
      )}

      {/* What's in flight and what's done — the same page answers both.
          Every row expands: the draft, the URL being checked, the points, and
          what happens next. Nothing is a black box. */}
      {board.verifying.length > 0 && (
        <Card title="Verifying" meta={`${board.verifying.length} in flight`}>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "0 0 12px" }}>
            You marked these done — ReachKit is re-checking your live pages to confirm each one actually
            shipped before it counts toward your score. Click any row for the full detail.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {board.verifying.map((a) => <LifecycleRow key={a.id} action={a} state="verifying" />)}
          </div>
        </Card>
      )}

      {board.done.length > 0 && (
        <Card title="Done" meta={`${board.done.length} verified`} info="Confirmed live, newest first — with the score movement actually measured at verification.">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {board.done.map((a) => <LifecycleRow key={a.id} action={a} state="done" />)}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--c-faint)" }}>
          Backed by your <Link href="/app/plan" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>content</Link> and{" "}
          <Link href="/app/plan" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>distribution</Link> analyses.
        </span>
        <Link href="/app/progress" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
          Verified wins land on your Progress timeline &rarr;
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generate more — POSTs /api/app/plan/generate (Task 4: paid + costed, cache-
// warm in the common path since it reuses the same synthesis gather the
// Plans/Synthesis intel pages already trigger) and, on success, refreshes the
// server-loaded board via `router.refresh()` so the new pending actions land
// on the calendar without a full reload.
// ---------------------------------------------------------------------------

function GenerateMoreControl({ todayKey }: { todayKey: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [higherImpactOnly, setHigherImpactOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: "empty" | "error" | "success"; text: string } | null>(null);

  const generate = useCallback(async () => {
    setPending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/app/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send our local day so the new actions pin to the same "today" this
        // plan renders (the server timezone may differ).
        body: JSON.stringify({ higherImpactOnly, today: todayKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: "error", text: "Couldn't generate right now — try again." });
        return;
      }
      const added = Array.isArray(json?.added) ? json.added : [];
      if (added.length === 0) {
        setNotice({ kind: "empty", text: "You're on top of it — your next scan surfaces more." });
      } else {
        // The new rows exist in `actions`, pinned to today — re-run the server
        // component so the board it reads picks them up and they appear in
        // today's list on this same page (no full reload).
        setNotice({ kind: "success", text: `Added ${added.length} action${added.length === 1 ? "" : "s"} to today` });
        router.refresh();
      }
    } catch {
      setNotice({ kind: "error", text: "Couldn't generate right now — try again." });
    } finally {
      setPending(false);
    }
  }, [higherImpactOnly, todayKey, router]);

  // The friendly "nothing new" and success notices are transient — they clear
  // themselves so they don't linger as stale chrome under the panel. The
  // error notice stays until the founder retries.
  useEffect(() => {
    if (!notice || notice.kind === "error") return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--c-line)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => void generate()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--c-action)", color: "var(--c-on-dark)",
            fontFamily: PJ, fontWeight: 600, fontSize: 12.5, lineHeight: 1,
            padding: "9px 15px", borderRadius: "var(--radius-lg)", border: "none",
            cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Generating…" : "✨ Generate more actions"}
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={higherImpactOnly}
            onChange={(e) => setHigherImpactOnly(e.target.checked)}
            disabled={pending}
            style={{ width: 14, height: 14, accentColor: "var(--c-action)" }}
          />
          Higher-impact only
        </label>
      </div>
      {notice && (
        <p role="status" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: notice.kind === "error" ? "var(--color-danger)" : "var(--c-muted)" }}>
          {notice.text}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar — Outrank-style month grids: every scheduled day carries its
// entries as chips; clicking a day focuses the workable panel below.
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// Kind colors come from the shared source of truth — calendar chips, entry
// cards, and lifecycle rows must always match.
const CHIP_STYLE = KIND_STYLE;

/**
 * Below 640px the month KEEPS its 7-column grid but swaps text chips for
 * kind-keyed DOTS (owner 2026-07-27).
 *
 * Seven columns on a phone leaves ~46px per day — too narrow for a readable
 * title, but plenty for a day number + a row of small coloured dots (one per
 * scheduled action, coloured by kind). The whole month then fits ONE screen as
 * a true overview (the agenda it replaced listed every day full-height, so the
 * calendar was a long scroll with no bird's-eye view). The calendar is a day
 * PICKER — tapping a day scrolls its actions into view in full underneath — so
 * the dots only need to convey "how much, of what kind", which they do. Empty
 * days stay in place (day number, no dots) to keep the Mon–Sun alignment.
 * `.rk-cal-chips` (desktop titles) and `.rk-cal-dots` (mobile dots) are toggled
 * purely in CSS here, never inline, so this media query actually wins.
 */
// Minified for the same reason as SHELL_CSS: template-literal contents ship
// verbatim, and /app/plan also sits on a pinned bundle baseline.
const CAL_CSS = `.rk-cal-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.rk-cal-day{display:flex;flex-direction:column;gap:3px;min-width:0;min-height:54px;padding:4px 5px 5px}.rk-cal-chips{display:flex;flex-direction:column;gap:3px;min-width:0}.rk-cal-chip{font-size:9.5px;line-height:1.25;border-radius:var(--radius-sm);padding:2px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rk-cal-dots{display:none;flex-wrap:wrap;gap:3px;align-items:center}.rk-cal-dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto}.rk-cal-dotmore{font-size:8px;font-family:var(--font-mono);color:var(--c-faint);line-height:1}@media (max-width:640px){.rk-cal-month{gap:4px}.rk-cal-day{min-height:44px;padding:4px 3px;gap:4px}.rk-cal-wd{text-align:center}.rk-cal-chips{display:none}.rk-cal-dots{display:flex}}`;

function PlanCalendar({ days, today, activeDate, onSelect }: {
  days: ScheduledDay[];
  today: Date;
  activeDate: string | null;
  onSelect: (date: string) => void;
}) {
  const byDate = new Map(days.map((d) => [d.date, d.entries]));
  const todayKey = localDateKey(today);

  // U2 (2026-07-25, refined): a TIGHT, always-populated window — 1 week in the past
  // + 3 weeks forward (4 full Mon-Sun weeks), never the old fixed month with ~3 weeks
  // of dead leading days, and never the loose "through last scheduled day" that ran
  // out to empty Aug/Sep weeks. ‹/› page the window a month (4 weeks) at a time;
  // "today" resets. Each new month that starts inside the window is marked on its
  // 1st-of-month cell so the month split is always clear.
  const startOfWeek = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Mon = start of week
    return x;
  };
  const WINDOW_DAYS = 4 * 7;
  const [pageShiftDays, setPageShiftDays] = useState(0);
  const start = startOfWeek(today);
  start.setDate(start.getDate() - 7 + pageShiftDays); // 1 week past + paging
  const cells = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
  const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const rangeTitle = `${fmtShort(cells[0]!)} – ${fmtShort(cells[cells.length - 1]!)}`;
  const atToday = pageShiftDays === 0;

  return (
    <div>
      {/* Range header + month paging (‹/›) — a fixed 4-week window that pages a
          month at a time; "today" resets to the current window. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 2px 8px" }}>
        <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0, minWidth: 130 }}>{rangeTitle}</h3>
        {!atToday && (
          <button type="button" onClick={() => setPageShiftDays(0)}
            style={{ background: "none", border: "none", padding: 0, fontFamily: JM, fontSize: 11, fontWeight: 700, color: "var(--c-action)", cursor: "pointer" }}>
            today
          </button>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
          <button type="button" aria-label="Previous weeks" onClick={() => setPageShiftDays((s) => s - WINDOW_DAYS)}
            style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--c-ink)", cursor: "pointer", lineHeight: 1 }}>‹</button>
          <button type="button" aria-label="Next weeks" onClick={() => setPageShiftDays((s) => s + WINDOW_DAYS)}
            style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--c-ink)", cursor: "pointer", lineHeight: 1 }}>›</button>
        </span>
      </div>

      <style>{CAL_CSS}</style>
      {/* ONE rolling grid — full weeks from this week forward (mobile: agenda of
          non-empty days via CAL_CSS). Layout lives in CAL_CSS so the mobile
          override can win; only dynamic/state styles stay inline. */}
      <div className="rk-cal-month">
        {WEEKDAYS.map((w) => (
          <span key={w} className="rk-cal-wd" style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)", padding: "0 4px" }}>{w}</span>
        ))}
        {cells.map((d) => {
          const key = localDateKey(d);
          const entries = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isActive = key === activeDate;
          const isPast = key < todayKey;
          // Every day is clickable — past days greyed but still selectable.
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              className={`rk-cal-day${entries.length === 0 ? " rk-cal-day--empty" : ""}${isToday ? " rk-cal-day--today" : ""}`}
              onClick={() => onSelect(key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(key); } }}
              aria-label={`${dayHeading(key)} — ${entries.length} ${entries.length === 1 ? "action" : "actions"}`}
              style={{
                border: `1px solid ${isActive ? "var(--c-action)" : "var(--c-line)"}`,
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--c-soft)" : "var(--c-surface)",
                opacity: isPast ? 0.5 : 1,
                cursor: "pointer",
              }}
            >
              <span className="rk-cal-daynum" style={{
                fontFamily: JM, fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                color: isToday ? "var(--c-on-dark)" : d.getDate() === 1 ? "var(--c-action)" : "var(--c-faint)",
                background: isToday ? "var(--c-action)" : "transparent",
                borderRadius: "var(--radius-full)", padding: isToday ? "3px 6px" : "3px 0",
                alignSelf: "flex-start", whiteSpace: "nowrap",
              }}>
                {/* Month split: the 1st of each month inside the window is labelled
                    (e.g. "Aug 1") in the accent colour, so a new month is always
                    marked without breaking the Mon-Sun column alignment. */}
                {d.getDate() === 1 ? `${d.toLocaleDateString("en-US", { month: "short" })} 1` : d.getDate()}
              </span>
              {/* Desktop: readable title chips (top 2 + overflow count). */}
              <div className="rk-cal-chips">
                {entries.slice(0, 2).map((e) => (
                  <span key={e.key} title={e.title} className="rk-cal-chip" style={{
                    fontFamily: PJ, fontWeight: 600,
                    color: CHIP_STYLE[e.kind].fg, background: CHIP_STYLE[e.kind].bg,
                  }}>
                    {e.title}
                  </span>
                ))}
                {entries.length > 2 && (
                  <span style={{ fontFamily: JM, fontSize: 9, color: "var(--c-faint)" }}>+{entries.length - 2}</span>
                )}
              </div>
              {/* Mobile: a kind-keyed dot per action (up to 5 + overflow) so the
                  whole month fits one screen. aria-hidden — the cell's aria-label
                  already announces the action count; the dots are the visual
                  density cue, decoded in full when the day is tapped. */}
              {entries.length > 0 && (
                <div className="rk-cal-dots" aria-hidden>
                  {entries.slice(0, 5).map((e) => (
                    <span key={e.key} className="rk-cal-dot" style={{ background: CHIP_STYLE[e.kind].fg }} />
                  ))}
                  {entries.length > 5 && <span className="rk-cal-dotmore">+{entries.length - 5}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle rows — verifying / verified actions, fully drillable.
// ---------------------------------------------------------------------------

function LifecycleRow({ action, state }: { action: BoardAction; state: "verifying" | "done" }) {
  const [open, setOpen] = useState(false);
  const pill = state === "verifying"
    ? { label: "Verifying", color: VERIFYING_COLOR }
    : { label: "Verified", color: VERIFIED_COLOR };

  return (
    <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", background: "var(--c-surface)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", padding: "14px 16px", cursor: "pointer" }}
      >
        <span aria-hidden style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontFamily: SG, fontWeight: 700, fontSize: 14, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.title}</span>
          {(() => {
            const k = KIND_STYLE[kindOfAction(action)];
            return (
              <span style={{ display: "inline-block", marginTop: 3, fontFamily: PJ, fontSize: 10, fontWeight: 700, color: k.fg, background: k.bg, padding: "2px 7px", borderRadius: "var(--radius-full)" }}>
                {k.label}
              </span>
            );
          })()}
        </span>
        {state === "done" && action.actualDelta !== null && (
          <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: VERIFIED_COLOR, whiteSpace: "nowrap" }}>{fmtPts(action.actualDelta)}</span>
        )}
        {state === "verifying" && action.predictedDelta !== null && (
          <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-action)", whiteSpace: "nowrap" }}>{fmtPts(action.predictedDelta)} predicted</span>
        )}
        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--c-on-dark)", background: pill.color, padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{pill.label}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 14px 33px", display: "flex", flexDirection: "column", gap: 8 }}>
          {action.why && <p style={{ fontSize: 12.5, color: "var(--c-muted)", lineHeight: 1.5, margin: 0 }}>{action.why}</p>}

          {/* What exactly is happening / happened */}
          <p style={{ fontSize: 12, color: "var(--c-muted)", lineHeight: 1.55, margin: 0, background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            {state === "verifying" ? (
              <>
                ReachKit is re-reading{" "}
                {action.verifyUrl
                  ? <a href={action.verifyUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", fontWeight: 600 }}>{action.verifyUrl}</a>
                  : "your live pages"}{" "}
                to confirm this shipped. Once confirmed it moves to Done, your score re-snapshots, and the measured
                movement appears here. If the check can&rsquo;t confirm it, the action returns to your queue with a Retry tag.
              </>
            ) : (
              <>
                Confirmed live{action.verifiedAt ? ` on ${new Date(action.verifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                {action.verifyUrl && (
                  <>{" "}at <a href={action.verifyUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", fontWeight: 600 }}>{action.verifyUrl}</a></>
                )}
                . {action.actualDelta !== null
                  ? `The score moved ${fmtPts(action.actualDelta)} at verification — measured, not estimated.`
                  : "No score snapshot was captured for this one, so no measured movement is shown."}
              </>
            )}
          </p>

          {action.draft && (
            <details>
              <summary style={{ fontFamily: PJ, fontSize: 12, fontWeight: 600, color: "var(--c-action)", cursor: "pointer" }}>View the draft behind this action</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: JM, fontSize: 11, lineHeight: 1.6, color: "var(--c-ink)", background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px", margin: "6px 0 0", maxHeight: 220, overflowY: "auto" }}>{action.draft}</pre>
            </details>
          )}

          <p style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", margin: 0 }}>
            Full history on your <Link href="/app/progress" style={{ color: "var(--c-action)", fontWeight: 700, textDecoration: "none" }}>Progress timeline →</Link>
          </p>
        </div>
      )}
    </div>
  );
}

function StripStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>
      <span style={{ fontFamily: JM, fontWeight: 700, color: color ?? "var(--c-ink)" }}>{value}</span> {label}
    </span>
  );
}

function EmptyPlan() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "56px 20px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)" }}>
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)" }}>Everything shipped — nice.</div>
      <p style={{ fontSize: 13, color: "var(--c-muted)", margin: 0, maxWidth: 460 }}>
        Your next scan refreshes the plan with new opportunities as your market moves.
      </p>
    </div>
  );
}
