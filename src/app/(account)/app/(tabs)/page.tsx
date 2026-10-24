// SPEC §4 (board Main) — the Overview tab, at `/app`, in the board's order:
// the head, today's page (or the line or card in its place), how far the live
// pages got, this week's pages, and the one optional line about the
// customer's own site.
//
// **Every read is a stored one.** No module fetches for itself, so the render
// performs no measurement, no vendor call and no model call.
//
// **It declares no `Surface`:** the shell's layout owns this route's screen
// root (see `../layout.tsx`).
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { readShell } from "../_shell/provider";
import { readOverview } from "../_overview/provider";
import { readPublished } from "../_overview/content-provider";
import { contentOf } from "@/lib/measure/published";
import { pageLadderOf } from "@/lib/measure/page-ladder";
import { PageLadder } from "../_overview/PageLadder";
import { overviewNotice, readOnboarding, readReleaseNotice } from "../_shell/onboarding";
import { FirstPageNotice, MarketChoice, ReleaseNoticeLine } from "../_shell/OnboardingStatus";
import { MARKET_TOO_SMALL, readCategoryChoice } from "../_shell/remeasure";
import { writtenLine } from "../_shell/written";
import { formatDay, formatTime, SHELL_LOCALE } from "../_shell/format";
import { copy } from "@/lib/presentation/copy";
import { dayKeyOf } from "../calendar/dates";
import { ISSUES_HREF } from "../_overview/alerts";
import { OverviewHead } from "../_overview/OverviewHead";
import { ThisWeek, type WeekList } from "../_overview/ThisWeek";
import { WaitingPageCard } from "../_overview/WaitingPageCard";
import { WeekWaiting } from "../_overview/WeekWaiting";
import { OVERVIEW, REGION } from "../_overview/frame";
import { readBlogReads, readGoogleVisits } from "../_overview/blog-reads-provider";
import { readPromptsAt } from "../_overview/prompts-provider";
import { aiPagesOf, bestMoverOf } from "@/lib/measure/figures";
import { AiFigure, MonthsFigure, MoverFigure } from "../_overview/Figures";

export const metadata: Metadata = { title: copy("meta.app.overview.title") };

/** Where publishing is turned back on. */
const PUBLISHING_SETTINGS = "/app/settings/publishing";

/** "Monday": the day a week's pages are chosen on, as a value. */
function weekdayOf(day: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "long" }).format(new Date(`${day}T00:00:00Z`));
}

export default async function OverviewPage(): Promise<React.JSX.Element> {
  const [shell, overview, onboarding, published] = await Promise.all([
    readShell(),
    readOverview(),
    readOnboarding(),
    readPublished(),
  ]);
  // Until the address is connected no page can go live: the screen is the
  // connect arm alone, and no part of it names a go-live time or the ladder.
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

  const running = onboarding.kind === "running";
  // Plan's own week, reached at the call: Plan's provider reaches the market's
  // modules, and this screen's graph holds no vendor client. Where it cannot be
  // read the list is not drawn and the rest stands.
  const [week, blogReads, googleVisits, reputation] = await Promise.all([
    running ? null : import("../_overview/this-week").then((m): Promise<WeekList | null> => m.readThisWeek()).catch(() => null),
    readBlogReads(),
    readGoogleVisits(),
    readPromptsAt(overview.months?.reading?.week ?? null),
  ]);
  const notice =
    onboarding.kind === "none" || onboarding.kind === "ended"
      ? overviewNotice({ onboarding, notice: await readReleaseNotice(), weekZero: shell.weeks.kind !== "counted" })
      : null;

  const content = contentOf(published);
  const ladder = content === null ? null : pageLadderOf(content.pages, published.now, googleVisits);
  const live = content?.pages.filter((page) => page.publishedAt <= published.now) ?? [];
  const aiPages = aiPagesOf(live);
  const mover = bestMoverOf(live, published.now);
  const weekPages = week?.rows.length ?? 0;

  // The head. A page that cannot go out without the customer outranks "nothing needs you".
  const today = formatDay(overview.today, shell.timeZone);
  const eyebrow = shell.weeks.kind === "counted" ? copy("overview.head.eyebrow", { n: String(shell.weeks.weeks), day: today }) : today;
  const needs = overview.alerts.find((alert) => alert.kind === "needs_you") ?? null;
  const showing = ladder?.google.find((step) => step.name === "draft.ladder.showing")?.count ?? null;
  const lead = [
    ladder === null || ladder.live === 0
      ? null
      : showing === null
        ? copy("overview.head.lead.live-unread", { live: String(ladder.live) })
        : copy("overview.head.lead.live", { live: String(ladder.live), showing: String(showing) }),
    week === null || weekPages === 0
      ? null
      : week.today === week.first
        ? copy("overview.head.lead.chosen", { n: String(weekPages) })
        : copy("overview.head.lead.chosen-on", { n: String(weekPages), weekday: weekdayOf(week.first) }),
  ]
    .filter((line) => line !== null)
    .join(" ");

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
  // Issue 837: an empty week over a market too small offers the choice that
  // fills it, unless the shell's panel already does.
  const tooSmall = notice === MARKET_TOO_SMALL || overview.supply?.key === "overview.supply.unmeasured";
  const settled = onboarding.kind === "none" || onboarding.kind === "ended";
  const choice = weekPages === 0 && settled && tooSmall ? await readCategoryChoice() : null;

  return (
    <div className={OVERVIEW} data-testid="overview">
      <FirstPageNotice state={onboarding} />
      <ReleaseNoticeLine noticeKey={notice} />

      <OverviewHead
        eyebrow={eyebrow}
        title={needs === null ? copy("overview.head.title") : copy(needs.key, needs.vars)}
        action={needs === null ? null : { label: copy(needs.actionKey), href: needs.href }}
        lead={lead === "" ? null : lead}
      />

      {paused ? (
        <section className="card card-border min-w-0 bg-base-100" data-testid="overview-paused">
          <div className="card-body min-w-0 gap-3 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
            <p className="min-w-0">{copy("overview.paused.line")}</p>
            <Link className="btn btn-soft btn-sm shrink-0" href={PUBLISHING_SETTINGS} prefetch={true}>
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

      {ladder === null ? null : <PageLadder ladder={ladder} timeZone={shell.timeZone} />}

      {running ? (
        <div className="min-w-0" data-frame={REGION.week}>
          <WeekWaiting />
        </div>
      ) : week !== null && weekPages > 0 ? (
        <div className="min-w-0" data-frame={REGION.week}>
          <ThisWeek week={week} scheduled={shell.publishing.next !== null} />
        </div>
      ) : (
        <>
          {supply === null ? null : (
            <p className="min-w-0 text-sm text-base-content/70" data-testid="overview-supply">
              {supply}
            </p>
          )}
          {choice === null ? null : <MarketChoice choice={choice} />}
        </>
      )}

      {aiPages === null && !blogReads.show && mover === undefined ? null : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <AiFigure pages={aiPages} reads={blogReads} />
          <MoverFigure mover={mover} timeZone={shell.timeZone} />
        </div>
      )}
      {overview.months === null ? null : <MonthsFigure months={overview.months} reputation={reputation} timeZone={shell.timeZone} />}

      {fixes === 0 ? null : (
        <section className="card card-border min-w-0 bg-base-100" data-testid="overview-fixes">
          <p className="card-body min-w-0 flex-row flex-wrap items-baseline gap-x-2 gap-y-1 p-4 text-sm">
            <strong>{fixes === 1 ? copy("overview.fixes.line.one") : copy("overview.fixes.line", { n: String(fixes) })}</strong>
            <span className="text-base-content/70">{copy("overview.fixes.optional")}</span>
            <Link className="link font-semibold" href={ISSUES_HREF} prefetch={true}>
              {copy("overview.fixes.see")}
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
