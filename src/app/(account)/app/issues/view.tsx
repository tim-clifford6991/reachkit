// Site Fixes, as plate F5 lays it out: the lead with the scan's day and who can fix them, the pages read and how they
// split, then the fixes on the left and the chosen fix on the right. Drawn only from `siteFixesScreen`.
import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "../_overview/present";
import { FixList } from "./FixList";
import type { SiteFixesScreen } from "./screen";

const OVERVIEW = "/app";

function Stats(p: { stats: NonNullable<SiteFixesScreen["stats"]> }): React.JSX.Element {
  const { stats } = p;
  return (
    <div className="stats stats-vertical card-border min-w-0 bg-base-100 lg:stats-horizontal" data-testid="issues-summary">
      <div className="stat">
        <div className="stat-title">{stats.site}</div>
        <div className="stat-value tabular-nums">{formatCount(stats.read)}</div>
        <div className="stat-desc">{stats.readLabel}</div>
      </div>
      {stats.split === null ? null : (
        <>
          <div className="stat">
            <div className="stat-value tabular-nums">{formatCount(stats.split.fine)}</div>
            <div className="stat-desc">{stats.split.fineLabel}</div>
          </div>
          <div className="stat">
            <div className="stat-value tabular-nums">{formatCount(stats.split.problem)}</div>
            <div className="stat-desc">{stats.split.problemLabel}</div>
            <div className="stat-desc whitespace-normal">{stats.split.ours}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function IssuesView(p: { screen: SiteFixesScreen }): React.JSX.Element {
  const { screen } = p;
  const head = (
    <>
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link href={OVERVIEW} className="btn btn-ghost btn-sm w-fit">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {copy("chrome.back-to-overview")}
        </Link>
        <h1>{copy("overview.issues.title")}</h1>
        <p className="min-w-0 text-base-content/70" data-testid="issues-lead">
          {screen.lead}
        </p>
      </header>
      {screen.stats === null ? null : <Stats stats={screen.stats} />}
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-3rem)] xl:h-[calc(100dvh-4rem)]" data-testid="issues">
      {screen.state === "fixes" ? (
        <Suspense fallback={head}>
          <FixList screen={screen} head={head} />
        </Suspense>
      ) : (
        head
      )}
      {screen.state === "unreadable" ? (
        <div role="alert" className="alert alert-soft alert-warning">
          {screen.line}
        </div>
      ) : screen.state === "unscanned" ? (
        <p className="text-sm" data-testid="issues-unscanned">
          {screen.line}
        </p>
      ) : screen.state === "empty" && screen.line !== null ? (
        <p className="flex min-w-0 items-center gap-2 text-sm" data-testid="issues-empty">
          <Check size={16} strokeWidth={2} className="shrink-0 text-success" aria-hidden />
          {screen.line}
        </p>
      ) : null}
    </div>
  );
}
