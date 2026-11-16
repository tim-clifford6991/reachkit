// SPEC §4 (board Main) — the Overview tab, at `/app`, in the board's order:
// the head (above the tabs), today's page (or the line or card in its place),
// the three totals so far, this week's pages, and the one optional line about
// the customer's own site.
//
// **Every read is a stored one.** No module fetches for itself, so the render
// performs no measurement, no vendor call and no model call.
//
// **It declares no `Surface`:** the shell's layout owns this route's screen
// root (see `../layout.tsx`).
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { readShell } from "../_shell/provider";
import { readOverview } from "../_overview/provider";
import { readWordPressWaiting } from "../_overview/wordpress-provider";
import { readTotalsNow } from "../_overview/totals-provider";
import { Totals } from "../_overview/Totals";
import { overviewNotice, readOnboarding, readReleaseNotice } from "../_shell/onboarding";
import { FirstPageNotice, ReleaseNoticeLine } from "../_shell/OnboardingStatus";
import { writtenLine } from "../_shell/written";
import { formatDate, formatDay, formatTime, SHELL_LOCALE } from "../_shell/format";
import { copy } from "@/lib/presentation/copy";
import { dayKeyOf } from "../calendar/dates";
import { ISSUES_HREF } from "../_overview/alerts";
import { OverviewHead } from "../_overview/OverviewHead";
import { WaitingPageCard } from "../_overview/WaitingPageCard";
import { WeekWaiting } from "../_overview/WeekWaiting";
import { HEAD, OVERVIEW, REGION } from "../_overview/frame";

export const metadata: Metadata = { title: copy("meta.app.overview.title") };

/** Where publishing is turned back on. */
const PUBLISHING_SETTINGS = "/app/settings/pages";

/** "Monday": the day a week's pages are chosen on, as a value. */
function weekdayOf(day: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "long" }).format(new Date(`${day}T00:00:00Z`));
}

export default async function OverviewPage(): Promise<React.JSX.Element> {
  const [shell, overview, onboarding, wordpressWaiting] = await Promise.all([
    readShell(),
    readOverview(),
    readOnboarding(),
    readWordPressWaiting(),
  ]);
  // Until the address is connected no page can go live: the screen is the
  // connect arm alone, and no part of it names a go-live time or a total.
  if (overview.connect !== null) {
    const { ConnectAddress } = await import("../_overview/ConnectAddress");
    return (
      <div className={OVERVIEW} data-testid="overview">
        <ConnectAddress
          connect={overview.connect}
          page={overview.waitingPage}
          timeZone={shell.timeZone}
          today={overview.today}
        />
      </div>
    );
  }

  // A WordPress set up without its credentials holds every page the same way: the head asks for it, then the page that waits.
  if (wordpressWaiting) {
    const { ConnectWaiting } = await import("../_overview/ConnectAddress");
    return (
      <div className={OVERVIEW} data-testid="overview">
        <div className={HEAD}>
          <OverviewHead
            eyebrow={copy("overview.connect.eyebrow.plain")}
            title={copy(overview.waitingPage === null ? "overview.connect.head" : "overview.connect.head.ready")}
            action={{ label: copy("overview.connect.wordpress.action"), href: PUBLISHING_SETTINGS }}
            lead={copy(overview.waitingPage === null ? "overview.connect.lead" : "overview.connect.lead.ready")}
          />
        </div>
        <ConnectWaiting page={overview.waitingPage} />
      </div>
    );
  }

  const running = onboarding.kind === "running";
  // Plan's own week and day cards, reached at the call: Plan's modules reach the
  // market's, and this screen's graph holds no vendor client. Where it cannot be
  // read the week is not drawn and the rest stands.
  const [thisWeek, totals] = await Promise.all([
    running
      ? null
      : import("../_overview/this-week").then(async (m) => ({ week: await m.readThisWeek(), ThisWeek: m.ThisWeek })).catch(() => null),
    readTotalsNow(),
  ]);
  const notice =
    onboarding.kind === "none" || onboarding.kind === "ended"
      ? overviewNotice({ onboarding, notice: await readReleaseNotice(), weekZero: shell.weeks.kind !== "counted" })
      : null;

  const week = thisWeek?.week ?? null;
  const weekPages = week?.pages ?? 0;

  // The head. A page that cannot go out without the customer outranks "nothing needs you".
  const today = formatDay(overview.today, shell.timeZone);
  const eyebrow = shell.weeks.kind === "counted" ? copy("overview.head.eyebrow", { n: String(shell.weeks.weeks), day: today }) : today;
  const needs = overview.alerts.find((alert) => alert.kind === "needs_you") ?? null;
  // The lead names no Google figure: the totals below are the one place for them.
  const lead =
    week === null || weekPages === 0
      ? null
      : week.today === week.first
        ? copy("overview.head.lead.chosen", { n: String(weekPages) })
        : copy("overview.head.lead.chosen-on", { n: String(weekPages), weekday: weekdayOf(week.first) });

  // In place of the today card: paused, or one quiet line about today.
  const paused = shell.publishing.next === null && shell.publishing.because === "publishing_paused";
  const liveToday =
    overview.lastLive !== null && dayKeyOf(overview.lastLive.at, shell.timeZone) === dayKeyOf(overview.today, shell.timeZone);
  const quiet = liveToday
    ? copy("overview.today.live", { time: formatTime(overview.lastLive!.at, shell.timeZone) })
    : week?.skippedToday === true
      ? copy("how.week.skip")
      : null;

  // The customer's own site: every check worth fixing, counted past the alert cap.
  const fixes =
    overview.alerts.filter((alert) => alert.kind === "site_issue").length + (overview.issuesOverflow?.remaining ?? 0);
  const supply = weekPages === 0 && overview.supply !== undefined ? writtenLine(overview.supply.key, overview.supply.vars) : null;

  return (
    <div className={OVERVIEW} data-testid="overview">
      <div className={HEAD}>
        <FirstPageNotice state={onboarding} />
        <ReleaseNoticeLine noticeKey={notice} due={formatDate(shell.nextDueOn, shell.timeZone)} />
        <OverviewHead
          eyebrow={eyebrow}
          title={needs === null ? copy("overview.head.title") : copy(needs.key, needs.vars)}
          action={needs === null ? null : { label: copy(needs.actionKey), href: needs.href }}
          lead={lead}
        />
      </div>

      {paused ? (
        <section className="card card-border min-w-0 bg-base-100" data-testid="overview-paused">
          <div className="card-body min-w-0 gap-3 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
            <p className="min-w-0">{copy("overview.paused.line")}</p>
            <Link className="btn btn-soft btn-sm min-h-11 shrink-0" href={PUBLISHING_SETTINGS} prefetch={true}>
              {copy("overview.paused.action")}
            </Link>
          </div>
        </section>
      ) : overview.waitingPage !== null ? (
        <WaitingPageCard
          page={overview.waitingPage}
          scheduled={shell.publishing.next !== null}
          timeZone={shell.timeZone}
          now={overview.today}
        />
      ) : quiet === null ? null : (
        <p className="min-w-0 text-sm text-base-content/70" data-testid="overview-today-line">
          {quiet}
        </p>
      )}

      {totals === null ? null : (
        <Totals
          totals={totals}
          due={{ measured: shell.nextDueOn, pages: shell.publishing.next ?? shell.nextDueOn }}
          timeZone={shell.timeZone}
        />
      )}

      {running ? (
        <div className="min-w-0" data-frame={REGION.week}>
          <WeekWaiting />
        </div>
      ) : thisWeek !== null && week !== null && weekPages > 0 ? (
        <div className="min-w-0" data-frame={REGION.week}>
          <thisWeek.ThisWeek week={week} scheduled={shell.publishing.next !== null} />
        </div>
      ) : supply === null ? null : (
        <p className="min-w-0 text-sm text-base-content/70" data-testid="overview-supply">
          {supply}
        </p>
      )}

      {fixes === 0 ? null : (
        <Link className="card card-border min-w-0 bg-base-100 hover:border-primary" href={ISSUES_HREF} prefetch={true} data-testid="overview-fixes">
          <span className="card-body min-w-0 flex-row flex-wrap items-center gap-x-3.5 gap-y-2.5 px-5 py-3.5 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-field bg-base-200 text-base-content/70" aria-hidden>
              <Wrench className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-[1_1_18rem]">
              <strong>{fixes === 1 ? copy("overview.fixes.line.one") : copy("overview.fixes.line", { n: String(fixes) })}</strong>
              <span className="text-base-content/70">{` ${copy("overview.fixes.optional")}`}</span>
            </span>
            <span className="font-semibold text-primary">{copy("overview.fixes.see")}</span>
          </span>
        </Link>
      )}
    </div>
  );
}
