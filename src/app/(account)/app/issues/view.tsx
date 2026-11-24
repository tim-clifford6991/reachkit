// Site Fixes, as plate F5 lays it out: the lead with the scan's day and who can fix them, the pages read and how they
// split, then the fixes on the left and the chosen fix on the right. Drawn only from `siteFixesScreen`.
import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "../_overview/present";
import { Failed } from "../_shell/Part";
import { FixList } from "./FixList";
import type { SiteFixesScreen } from "./screen";

const OVERVIEW = "/app";

function Summary(p: { summary: NonNullable<SiteFixesScreen["summary"]> }): React.JSX.Element {
  const { read, split } = p.summary;
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="issues-read" data-testid="issues-summary">
      <div className="card-body min-w-0 gap-1.5 p-5 max-sm:px-4">
        <p id="issues-read" className="eyebrow">
          {read}
        </p>
        {split === null ? null : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2.5" data-testid="issues-fine">
              <span className="figure text-4xl leading-none">{formatCount(split.fine)}</span>
              <span className="text-sm text-base-content/70">{split.fineLabel}</span>
            </p>
            <p className="text-sm">
              {split.problemLine === null ? null : `${split.problemLine} `}
              {split.ours}
            </p>
          </>
        )}
      </div>
    </section>
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
      {screen.summary === null ? null : <Summary summary={screen.summary} />}
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
        <Failed testId="issues-unreadable" />
      ) : screen.state === "unscanned" ? (
        <p className="text-sm" data-testid="issues-unscanned">
          {screen.line}
        </p>
      ) : screen.state === "empty" ? (
        <p className="flex min-w-0 items-center gap-2 text-sm" data-testid="issues-empty">
          <Check size={16} strokeWidth={2} className="shrink-0 text-success" aria-hidden />
          {screen.line}
        </p>
      ) : null}
    </div>
  );
}
