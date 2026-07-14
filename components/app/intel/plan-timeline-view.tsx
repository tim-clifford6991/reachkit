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

import { useCallback, useEffect, useMemo, useState } from "react";
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
  // Reset the "more" toggle when the founder switches days — adjusted during
  // render (React's recommended reset-on-prop-change pattern) rather than in
  // an effect, so there's no extra render pass / no setState-in-effect lint.
  const [showMore, setShowMore] = useState(false);
  const [showMoreForDate, setShowMoreForDate] = useState(activeDate);
  if (showMoreForDate !== activeDate) {
    setShowMoreForDate(activeDate);
    setShowMore(false);
  }

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
          <PlanCalendar days={days} today={today} activeDate={activeDate} onSelect={setSelected} />

          {/* The selected day, workable in place */}
          {activeDate && (
            <section>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {headlineEntries.map((e) => <PlanEntryCard key={e.key} entry={e} domain={domain} detail={detailFor(e)} />)}
                  {extraEntries.length > 0 && (
                    <>
                      {showMore && extraEntries.map((e) => <PlanEntryCard key={e.key} entry={e} domain={domain} detail={detailFor(e)} />)}
                      <button
                        type="button"
                        onClick={() => setShowMore((s) => !s)}
                        style={{
                          alignSelf: "flex-start", background: "none", border: "none", padding: "2px 0",
                          fontFamily: JM, fontSize: 11, fontWeight: 700, color: "var(--c-action)", cursor: "pointer",
                        }}
                      >
                        {showMore ? "▾ show fewer" : `▸ +${extraEntries.length} more scheduled today`}
                      </button>
                    </>
                  )}
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

function PlanCalendar({ days, today, activeDate, onSelect }: {
  days: ScheduledDay[];
  today: Date;
  activeDate: string | null;
  onSelect: (date: string) => void;
}) {
  const byDate = new Map(days.map((d) => [d.date, d.entries]));
  const todayKey = localDateKey(today);
  const last = days[days.length - 1]!.date;
  const [ly, lm] = last.split("-").map(Number);

  // Month slides: previous month (context/history) through the last scheduled
  // month — one full-width slide each, horizontally scrollable.
  const months: { year: number; month: number }[] = [];
  {
    let y = today.getFullYear(), m = today.getMonth() - 1;
    if (m < 0) { m = 11; y--; }
    while (y < ly! || (y === ly! && m <= lm! - 1)) {
      months.push({ year: y, month: m });
      m === 11 ? (m = 0, y++) : m++;
    }
  }
  const currentIdx = months.findIndex((x) => x.year === today.getFullYear() && x.month === today.getMonth());

  // State-driven slider (transform paging). Opens on the CURRENT month.
  // Deliberately NOT native scroll-snap: Chrome's mandatory snapping fights
  // programmatic scrolls and can snap back mid-animation — arrows must always
  // land exactly one month over.
  const [slide, setSlide] = useState(Math.max(0, currentIdx));
  const goTo = (index: number) => setSlide(Math.min(months.length - 1, Math.max(0, index)));
  const go = (dir: -1 | 1) => goTo(slide + dir);

  const active = months[slide] ?? months[0]!;
  const monthTitle = new Date(active.year, active.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const navBtn: React.CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)",
    width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, color: "var(--c-ink)", cursor: "pointer", lineHeight: 1,
  };

  return (
    <div>
      {/* Month header + prev/next */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 2px 8px" }}>
        <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0, minWidth: 130 }}>{monthTitle}</h3>
        {slide !== currentIdx && (
          <button type="button" onClick={() => goTo(currentIdx)}
            style={{ background: "none", border: "none", padding: 0, fontFamily: JM, fontSize: 11, fontWeight: 700, color: "var(--c-action)", cursor: "pointer" }}>
            back to today
          </button>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
          <button type="button" aria-label="Previous month" onClick={() => go(-1)} disabled={slide === 0} style={{ ...navBtn, opacity: slide === 0 ? 0.4 : 1 }}>‹</button>
          <button type="button" aria-label="Next month" onClick={() => go(1)} disabled={slide === months.length - 1} style={{ ...navBtn, opacity: slide === months.length - 1 ? 0.4 : 1 }}>›</button>
        </span>
      </div>

      {/* Slides — transform paging, one month per viewport width */}
      <div style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", transform: `translateX(-${slide * 100}%)`, transition: "transform 0.3s ease" }}>
        {months.map(({ year, month }) => {
          const first = new Date(year, month, 1);
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const lead = (first.getDay() + 6) % 7; // Mon-first offset
          const cells: (number | null)[] = [
            ...Array.from({ length: lead }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];
          return (
            <div key={`${year}-${month}`} style={{ flex: "0 0 100%", minWidth: 0 }} aria-hidden={months[slide] !== undefined && !(months[slide]!.year === year && months[slide]!.month === month)}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
                {WEEKDAYS.map((w) => (
                  <span key={w} style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)", padding: "0 4px" }}>{w}</span>
                ))}
                {cells.map((dayNum, i) => {
                  if (dayNum === null) return <span key={`b${i}`} />;
                  const key = localDateKey(new Date(year, month, dayNum));
                  const entries = byDate.get(key) ?? [];
                  const isToday = key === todayKey;
                  const isActive = key === activeDate;
                  const isPast = key < todayKey;
                  // Every day is clickable — past days included, greyed via
                  // opacity but still selectable so the founder can review what
                  // was (or wasn't) scheduled on a day that's already gone.
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(key)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(key); } }}
                      aria-label={`${dayHeading(key)} — ${entries.length} ${entries.length === 1 ? "action" : "actions"}`}
                      style={{
                        minHeight: 54,
                        border: `1px solid ${isActive ? "var(--c-action)" : "var(--c-line)"}`,
                        borderRadius: "var(--radius-md)",
                        background: isActive ? "var(--c-soft)" : "var(--c-surface)",
                        padding: "4px 5px 5px",
                        opacity: isPast ? 0.5 : 1,
                        cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
                      }}
                    >
                      <span style={{
                        fontFamily: JM, fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                        color: isToday ? "var(--c-on-dark)" : "var(--c-faint)",
                        background: isToday ? "var(--c-action)" : "transparent",
                        borderRadius: "var(--radius-full)", padding: isToday ? "3px 6px" : "3px 0",
                        alignSelf: "flex-start",
                      }}>
                        {dayNum}
                      </span>
                      {entries.slice(0, 2).map((e) => (
                        <span key={e.key} title={e.title} style={{
                          fontFamily: PJ, fontSize: 9.5, fontWeight: 600, lineHeight: 1.25,
                          color: CHIP_STYLE[e.kind].fg, background: CHIP_STYLE[e.kind].bg,
                          borderRadius: "var(--radius-sm)", padding: "2px 5px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {e.title}
                        </span>
                      ))}
                      {entries.length > 2 && (
                        <span style={{ fontFamily: JM, fontSize: 9, color: "var(--c-faint)" }}>+{entries.length - 2}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
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
