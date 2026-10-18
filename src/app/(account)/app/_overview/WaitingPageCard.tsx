// SPEC §4 (2026-10-07, issue 1319; 2026-10-09, issue 1362) — today's page
// of the daily autopilot, first on `/app` while one is in review.
//
// The screen's head — what autopilot is doing, which while a page is in
// review is when that page goes live — then the page's own title, how long
// until it goes live, and the two things the customer can do: edit it or
// stop it. It asks for nothing. The reason, the chances and the page as a
// reader will see it are one step away, behind the first control.
//
// **It carries the screen's `h1`.** The head line is about this page, so
// the two are one element and the screen says it once.
//
// **The screen's one solid button opens the page** (docs/DESIGN.md rule 1:
// one solid primary per screen). Stop is the warning ghost.
//
// **It writes no sentence.** The words are the registry's; the title is the
// customer's own.
//
// **It cannot overflow.** The controls sit beside the words from `md` and
// under them below it; the title is clamped to one line in a box that holds
// its own text (docs/DESIGN.md: a label that can grow is clamped).
import type React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatDateTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { BADGE } from "./badges";
import { GoesLiveIn } from "./GoesLiveIn";
import type { HeadNote } from "./ScoreHead";
import { StopThisPage } from "./StopThisPage";
import type { WaitingPage } from "./waiting";

const TEST_ID = "overview-waiting";
const READ_ACTION = "overview.alert.pending-veto.action" satisfies CopyKey;

/** The countdown's sentence, cut around its value. A sentinel no copy holds
 *  marks the slot, so the words stay the registry's and the client ticks
 *  only the value. */
const SLOT = "\u0000";

function When(p: { goesLiveAt: Date | null; timeZone: string; now: Date }): React.JSX.Element | null {
  if (p.goesLiveAt === null) return <>{writtenLine("overview.waiting.waits")}</>;
  const absolute = formatDateTime(p.goesLiveAt, p.timeZone);
  const passed = writtenLine("overview.waiting.goes-live", { at: absolute });
  const live = writtenLine("overview.waiting.goes-live-in", { left: SLOT });
  const [before, after] = live?.split(SLOT) ?? [];
  if (before === undefined || after === undefined) return passed === null ? null : <>{passed}</>;
  return (
    <GoesLiveIn
      at={p.goesLiveAt.toISOString()}
      absolute={absolute}
      before={before}
      after={after}
      passed={passed ?? absolute}
      now={p.now.getTime()}
    />
  );
}

export function WaitingPageCard(p: {
  page: WaitingPage;
  /** The screen's head line, already written. */
  head: string;
  /** The quiet lines under the page, already written. */
  notes: readonly HeadNote[];
  /** Whether a publish is scheduled at all — the shell's own answer. */
  scheduled: boolean;
  timeZone: string;
  now: Date;
}): React.JSX.Element {
  const { page } = p;
  // New page or update: the first of the model's chips.
  const [kindKey] = page.badges;
  // Publishing is off, or ReachKit stopped: the head says so, and a
  // countdown beside it would say the page is on its way.
  const held = page.goesLiveAt !== null && !p.scheduled;

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={TEST_ID}>
      <div className="card-body min-w-0 gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-1" data-testid="overview-head">
          <h1>{p.head}</h1>
          <div className="flex min-w-0 items-center gap-2 text-sm">
            {kindKey === undefined ? null : <span className={`${BADGE.neutral} shrink-0`}>{copy(kindKey)}</span>}
            <p className="min-w-0 truncate font-semibold" title={page.title} data-testid="overview-waiting-title">
              {page.title}
            </p>
          </div>
          {held ? null : (
            <p className="text-sm text-base-content/70" data-testid="overview-waiting-when">
              <When goesLiveAt={page.goesLiveAt} timeZone={p.timeZone} now={p.now} />
            </p>
          )}
          {p.notes.map((note) => (
            <p key={note.testId} className="min-w-0 text-sm text-base-content/70" data-testid={note.testId}>
              {note.line}
            </p>
          ))}
        </div>

        <div className="flex min-w-0 shrink-0 flex-wrap items-start gap-3">
          <Link className="btn btn-primary" href={page.href} prefetch={true} data-testid="overview-waiting-read">
            <BookOpen size={20} strokeWidth={1.75} aria-hidden />
            {copy(READ_ACTION)}
          </Link>
          <StopThisPage draftId={page.draftId} />
        </div>
      </div>
    </section>
  );
}
