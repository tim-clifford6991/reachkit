"use client";
// Site Fixes' list and the chosen fix. From `lg` the two stand side by side; below it the chosen fix takes the list's
// place, under its Back, and Back returns focus to the row. The choice lives in `?fix=`.
import type React from "react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { ArrowLeft, ExternalLink, Wrench } from "lucide-react";
import { SITE_CHECK_ICON } from "@/lib/presentation/site-issues";
import type { FixRow, FixTone, SiteFixesScreen } from "./screen";

const WIDE = "(min-width: 64rem)";

// Plate F5: critical in the warning tone and the rest quiet, since a site fix is optional, never an alarm.
const BADGE: Readonly<Record<FixTone, string>> = {
  critical: "badge badge-soft badge-warning",
  worth_fixing: "badge border-0 bg-base-200 text-base-content/70",
  not_run: "badge border-0 bg-base-200 text-base-content/70",
};

const TILE: Readonly<Record<FixTone, string>> = {
  critical: "bg-(--warn-bg) text-warning",
  worth_fixing: "bg-base-200 text-base-content/70",
  not_run: "bg-base-200 text-base-content/70",
};

function Tile(p: { row: FixRow }): React.JSX.Element {
  const Icon = SITE_CHECK_ICON[p.row.id];
  return (
    <span aria-hidden className={`rounded-field grid size-9 shrink-0 place-items-center ${TILE[p.row.tone]}`}>
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

const rowLink = (id: string) => document.querySelector<HTMLElement>(`[data-testid="fix-row-${id}"] a`);

function Detail(p: { row: FixRow; words: SiteFixesScreen["words"]; onBack: () => void; hiddenOnPhone: boolean }): React.JSX.Element {
  const { row, words } = p;
  return (
    <section
      className={`card card-border min-w-0 bg-base-100 lg:col-span-3 lg:flex lg:min-h-0 lg:flex-col ${p.hiddenOnPhone ? "max-lg:hidden" : ""}`}
      aria-labelledby="fix-name"
      data-testid="fix-detail"
    >
      <div className="card-body min-w-0 gap-3.5 p-5 max-sm:px-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <button type="button" className="btn btn-ghost btn-sm w-fit lg:hidden" onClick={p.onBack} data-testid="fix-back">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          {words.back}
        </button>
        <div className="flex min-w-0 flex-wrap items-center gap-3" aria-live="polite">
          <h2 id="fix-name" tabIndex={-1} className="card-title min-w-0 flex-1 basis-50 text-base focus:outline-none">
            {row.name}
          </h2>
          <span className={BADGE[row.tone]}>{row.badge}</span>
        </div>
        {row.share === null ? null : <p className="text-sm">{row.share}</p>}
        <div className="flex min-w-0 gap-2 rounded-box bg-base-200 p-3 text-sm">
          <Wrench size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0" data-testid="fix-text">
            {row.tone === "not_run" ? null : <strong>{words.fixLabel} </strong>}
            {row.fix}
          </p>
        </div>
        {row.heading === null ? null : (
          <>
            <p className="eyebrow" id="fix-pages-name">
              {row.heading}
            </p>
            <div className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" tabIndex={0} aria-labelledby="fix-pages-name" data-testid="fix-pages">
              <ul className="list min-w-0">
                {row.pages.map((page) => (
                  <li key={page.url} className="list-row min-w-0 items-baseline px-0 py-2">
                    <a className="link link-primary link-hover list-col-grow min-w-0 font-mono text-sm break-all" href={page.url} rel="noopener noreferrer" target="_blank">
                      {page.address}
                      <ExternalLink className="ms-1 inline size-3.5 align-[-0.125em]" strokeWidth={1.75} aria-hidden />
                      <span className="sr-only"> {words.newTab}</span>
                    </a>
                    {page.seconds === null ? null : <span className="text-sm tabular-nums">{page.seconds}</span>}
                  </li>
                ))}
              </ul>
              {row.note === null ? null : <p className="text-xs text-base-content/70">{row.note}</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function FixList(p: { screen: SiteFixesScreen; head: React.ReactNode }): React.JSX.Element {
  const [fix, setFix] = useQueryState("fix", parseAsString.withOptions({ history: "push" }));
  const { rows, words } = p.screen;
  const asked = rows.find((row) => row.id === fix);
  // From `lg` the first fix is open by default; below it nothing is until a row is chosen.
  const chosen = asked ?? rows[0];
  const open = asked !== undefined;

  function choose(event: React.MouseEvent, id: string): void {
    event.preventDefault();
    void setFix(id).then(() => {
      if (!window.matchMedia(WIDE).matches) document.getElementById("fix-name")?.focus();
    });
  }

  function back(): void {
    const from = chosen?.id;
    void setFix(null).then(() => (from === undefined ? undefined : rowLink(from)?.focus()));
  }

  return (
    <>
      <div className={`flex min-w-0 flex-col gap-4 ${open ? "max-lg:hidden" : ""}`}>{p.head}</div>
      {chosen === undefined ? null : (
        <div className="grid min-w-0 items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-5 lg:grid-rows-[minmax(0,1fr)] lg:items-stretch">
          <nav className={`card card-border min-w-0 bg-base-100 lg:col-span-2 lg:min-h-0 lg:overflow-y-auto ${open ? "max-lg:hidden" : ""}`} aria-label={words.list} data-testid="fix-list">
            <ul className="list min-w-0" data-testid="fix-rows">
              {rows.map((row) => (
                <li key={row.id} className="min-w-0" data-testid={`fix-row-${row.id}`}>
                  <Link
                    href={`?fix=${row.id}`}
                    prefetch={true}
                    scroll={false}
                    onClick={(event) => choose(event, row.id)}
                    aria-current={row.id === chosen.id ? "true" : undefined}
                    className={`list-row min-w-0 items-center rounded-none border-l-4 hover:bg-base-200 ${row.id === chosen.id ? "border-l-primary bg-base-200" : "border-l-transparent"}`}
                  >
                    <Tile row={row} />
                    <span className="list-col-grow min-w-0">
                      <span className="block font-semibold">{row.name}</span>
                      {row.share === null ? null : <span className="block text-sm text-base-content/70">{row.share}</span>}
                    </span>
                    <span className={BADGE[row.tone]}>{row.badge}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Detail row={chosen} words={words} onBack={back} hiddenOnPhone={!open} />
        </div>
      )}
    </>
  );
}
