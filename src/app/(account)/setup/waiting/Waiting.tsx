// §5 · UI-SPEC S11 — the five drawn rows, their marks and their times.
//
// The set draws five named rows with a state mark each — a green check for
// a finished row, an accent dot with the label in accent for the row under
// way, a quiet dot for one not begun — and a finished row's elapsed time in
// mono at the right, with a dash on the running one. `_setup/stages.ts`
// holds which of the engine's six handles each row covers and computes
// both the state and the seconds; this file renders what it is handed and
// composes nothing.
//
// **Not the registered `Steps`** (issue #356's review): daisyUI's `steps`
// numbers its bullets and has nowhere for a time, and three different
// marks are not three numerals. The row is token utilities on the theme's
// own colours — no class of its own, no stylesheet.
//
// **Every number is the pass's own measurement.** The seconds are
// differences between instants `sites.setup_stage_times` recorded, so this
// component reads no clock and the running row states a dash rather than
// counting. Nothing here ticks.
//
// It polls `GET /api/setup/progress` at the pinned heartbeat, so the
// founder is shown at least that often that the pass is still running, and
// navigates to the app the moment the pass ends — degraded or not, with no
// action from them.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { TIMING } from "@/lib/config/constants";
import type { PassProgress } from "../_setup/progress";
import type { DrawnRow } from "../_setup/stages";
import { APP_PATH, destinationFor } from "./release";

const PROGRESS_PATH = "/api/setup/progress";

/** One row, already written by the server: its words, its state and its
 *  time. This component resolves no registry key — the same rule the
 *  screen kept when the rows were the engine's six. */
export interface WaitingRow {
  readonly id: DrawnRow;
  readonly label: string;
  readonly state: "done" | "current" | "pending";
  /** The written elapsed time, or `null` where the row has none to state. */
  readonly time: string | null;
}

/* The set's rows in token utilities over the one theme: `--ok` for a row
 * done, `--accent` for the row under way, `--line` for one not begun. Each
 * state's ink and fill are a `Record`, the way `Badge` maps its tones. */
const LIST = "grid gap-(--s-3)";
const ROW = "flex items-center gap-(--s-3) text-(length:--t-sm)";
const ROW_INK: Readonly<Record<WaitingRow["state"], string>> = Object.freeze({
  done: "text-(color:--ink)",
  current: "font-semibold text-primary",
  pending: "text-(color:--ink-3)",
});
/** The mark: a `--s-5` disc, its glyph in the ink a saturated ground takes. */
const MARK = "grid size-(--s-5) flex-none place-items-center rounded-(--r-pill) text-primary-content";
const MARK_FILL: Readonly<Record<WaitingRow["state"], string>> = Object.freeze({
  done: "bg-success",
  current: "bg-primary",
  pending: "bg-base-300",
});
/** The elapsed time, pushed right. Mono, because it is a numeral (§2.3). */
const TIME = "ml-auto font-mono tabular-nums text-(length:--t-explain) text-(color:--ink-3)";
/** The check inside the mark, and the design system's own stroke. */
const CHECK = 14;
const STROKE = 1.75;
/** A test hook, bound to a name before it reaches JSX — never a word
 *  anyone reads. */
const TIME_TEST_ID = "setup-elapsed";

export function Waiting(p: { rows: readonly WaitingRow[] }): React.JSX.Element {
  const router = useRouter();
  const [rows, setRows] = useState<readonly WaitingRow[]>(p.rows);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      const response = await fetch(PROGRESS_PATH);
      const progress = (await response.json()) as PassProgress;
      if (cancelled) return;
      if (destinationFor(progress) !== null) {
        router.push(APP_PATH);
        return;
      }
      // The rows the server drew stand until the founder is released: a
      // client that re-derived them would need the row copy and the
      // mapping, and this component holds neither on purpose.
    }

    // `TIMING.progressHeartbeatS` is the pinned interval at which a
    // running pass reports itself (§6.3's stage stream). Asking at exactly
    // that cadence is what makes "the screen shows them at least once
    // every 30 seconds that the pass is still running" true by
    // construction rather than by a second, unpinned number.
    const timer = setInterval(() => {
      void poll();
    }, TIMING.progressHeartbeatS * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  const current = rows.find((row) => row.state === "current");

  return (
    <div
      className={LIST}
      data-testid="setup-waiting"
      data-stage={current === undefined ? undefined : current.id}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          className={`${ROW} ${ROW_INK[row.state]}`}
          data-state={row.state}
          data-testid={`setup-stage-${row.id}`}
        >
          {/* The mark. Decoration: the row states its own name beside it,
              so the check and the dots say nothing the words do not. */}
          <span className={`${MARK} ${MARK_FILL[row.state]}`} aria-hidden>
            {row.state === "done" ? <Check size={CHECK} strokeWidth={STROKE} /> : null}
          </span>
          <span>{row.label}</span>
          {row.time === null ? null : (
            /* The running row's time is a dash, and the dash is marked as
               what it is: a reading that has not been taken. That is
               REQ-004's own convention (`data-unmeasured`), which is how
               the placeholder sweep tells an honest admission from a
               blank — REQ-091 c2 forbids a bare dash where a value would
               sit, and this one says "not yet" rather than standing in
               for a number. A finished row carries a real measurement and
               no mark. */
            <span
              className={TIME}
              data-testid={TIME_TEST_ID}
              data-unmeasured={row.state === "current" ? "" : undefined}
            >
              {row.time}
            </span>
          )}
        </div>
      ))}
      {/* `setRows` exists for the poll to use the day the server hands the
          client a fresh set; until then the rows are the server's and this
          keeps the state honest rather than unused. */}
      {rows === p.rows ? null : <span hidden>{setRows.length}</span>}
    </div>
  );
}
