// SPEC §4 (owner E4, 2026-10-19; board Main) — today's page, first on
// `/app` while one is in review: when it goes live, its title, that nothing
// is needed, *Read or edit* and *Stop this page* with what Stop does. It
// carries the screen's `h1`, the head line about this page, so it is said
// once; the one solid button opens the page and Stop is the warning ghost.
import type React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatDateTime, formatTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { dayKeyOf } from "../calendar/dates";
import type { HeadNote } from "./ScoreHead";
import { StopThisPage } from "./StopThisPage";
import type { WaitingPage } from "./waiting";

const TEST_ID = "overview-waiting";
const READ_ACTION = "overview.alert.pending-veto.action" satisfies CopyKey;

function When(p: { goesLiveAt: Date | null; timeZone: string; now: Date }): React.JSX.Element | null {
  if (p.goesLiveAt === null) return <>{writtenLine("overview.waiting.waits")}</>;
  const absolute = formatDateTime(p.goesLiveAt, p.timeZone);
  const line =
    dayKeyOf(p.goesLiveAt, p.timeZone) === dayKeyOf(p.now, p.timeZone)
      ? writtenLine("overview.today.eyebrow", { time: formatTime(p.goesLiveAt, p.timeZone) })
      : writtenLine("overview.waiting.goes-live", { at: absolute });
  return (
    <time dateTime={p.goesLiveAt.toISOString()} title={absolute}>
      {line}
    </time>
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
  // Publishing is off, or ReachKit stopped: the head says so, and a time
  // beside it would say the page is on its way.
  const held = page.goesLiveAt !== null && !p.scheduled;

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={TEST_ID}>
      <div className="card-body min-w-0 gap-4 p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1" data-testid="overview-head">
          <h1>{p.head}</h1>
          {held ? null : (
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/70" data-testid="overview-waiting-when">
              <When goesLiveAt={page.goesLiveAt} timeZone={p.timeZone} now={p.now} />
            </p>
          )}
          <p className="min-w-0 truncate font-semibold" title={page.title} data-testid="overview-waiting-title">
            {page.title}
          </p>
          <p className="text-sm">{copy("overview.today.ready")}</p>
          {p.notes.map((note) => (
            <p key={note.testId} className="min-w-0 text-sm text-base-content/70" data-testid={note.testId}>
              {note.line}
            </p>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:max-w-xs">
          <div className="flex min-w-0 flex-wrap items-start gap-3">
            <Link className="btn btn-primary" href={page.href} prefetch={true} data-testid="overview-waiting-read">
              <BookOpen size={20} strokeWidth={1.75} aria-hidden />
              {copy(READ_ACTION)}
            </Link>
            <StopThisPage draftId={page.draftId} />
          </div>
          <p className="text-xs text-base-content/70" data-testid="overview-stop-note">
            {copy("overview.today.stop-note")}
          </p>
        </div>
      </div>
    </section>
  );
}
