// SPEC §4 (owner E4, 2026-10-19; board Main) — today's page, first on
// `/app` while one is in review: when it goes live, its title, *Read or edit*
// and *Stop this page*, and what Stop does.
import type React from "react";
import Link from "next/link";
import { Clock4, Eye } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatDateTime, formatTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { dayKeyOf } from "../calendar/dates";
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
      <div className="card-body min-w-0 flex-row flex-wrap items-center gap-x-5 gap-y-3.5 p-4 sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-field bg-primary/10 text-primary" aria-hidden>
          <Clock4 className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-0.5">
          {held ? null : (
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary" data-testid="overview-waiting-when">
              <When goesLiveAt={page.goesLiveAt} timeZone={p.timeZone} now={p.now} />
            </p>
          )}
          <p className="line-clamp-2 min-w-0 font-bold" title={page.title} data-testid="overview-waiting-title">
            {page.title}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-start gap-2.5">
          <Link className="btn btn-soft btn-primary min-h-11" href={page.href} prefetch={true} data-testid="overview-waiting-read">
            <Eye size={20} strokeWidth={1.75} aria-hidden />
            {copy(READ_ACTION)}
          </Link>
          <StopThisPage draftId={page.draftId} />
        </div>
        <p className="basis-full text-xs text-base-content/70" data-testid="overview-stop-note">
          {copy("overview.today.stop-note")}
        </p>
      </div>
    </section>
  );
}
