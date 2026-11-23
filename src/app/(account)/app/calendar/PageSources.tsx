// SPEC §7 *This week* — a written page's sources. From `sm` a number swaps the article for the list with its entry
// picked, and an entry's Show in Page swaps back with its sentences marked; below `sm` a number opens its entry in a
// bottom sheet and the whole list follows the article. Every count and date is the screen model's.
"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Quote } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { SourceEntryModel, SourcesModel } from "./week-screen";

/** Tailwind's `sm`: below it a number opens a sheet rather than the list. */
const SWAPS = "(min-width: 40rem)";
const MARKED = ["bg-primary/15", "rounded-field"] as const;

type Shown = "all" | "site" | "public";

function Entry(p: { entry: SourceEntryModel; id: string; picked: boolean; onShow?: (n: number) => void }): React.JSX.Element {
  const { entry } = p;
  return (
    <li id={p.id} tabIndex={-1} className={`list-row min-w-0 ${p.picked ? MARKED.join(" ") : ""}`} data-testid="source-entry">
      <span className="num font-semibold">{entry.n ?? ""}</span>
      <div className="list-col-grow flex min-w-0 flex-col gap-1 text-sm">
        <span className="font-semibold wrap-anywhere">{entry.kindLine}</span>
        <a href={entry.url} target="_blank" rel="noopener" className="link font-mono text-xs break-all">
          {entry.url}
          <span className="sr-only"> {copy("draft.live.new-tab")}</span>
        </a>
        {entry.passages.map((passage) => (
          <blockquote key={passage} className="border-s-2 border-base-300 ps-3 whitespace-pre-line">
            {passage}
          </blockquote>
        ))}
        {[entry.many, entry.dated, entry.read, entry.used, entry.kept].map((line) => (line === null ? null : <span key={line} className="text-base-content/70">{line}</span>))}
        {p.onShow === undefined || entry.n === null ? null : (
          <button type="button" className="btn btn-ghost btn-xs self-start" onClick={() => p.onShow!(entry.n!)}>
            {copy("calendar.sources.show-in-page")}
          </button>
        )}
      </div>
    </li>
  );
}

/** The summary, the filter, the entries and the foot: the pane's list and the page screen's Sources tab alike. */
export function PageSources(p: {
  sources: SourcesModel;
  draftId: string;
  picked: number | null;
  onShow?: (n: number) => void;
  /** The filter, where the caller resets it. */
  shown?: Shown;
  onShown?: (shown: Shown) => void;
}): React.JSX.Element {
  const [own, setOwn] = useState<Shown>("all");
  const shown = p.shown ?? own;
  const setShown = p.onShown ?? setOwn;
  const entries = p.sources.entries.filter((entry) => shown === "all" || entry.kind === shown);
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={p.sources.heading === null ? undefined : `sources-${p.draftId}`} data-testid="page-sources">
      {p.sources.heading === null ? null : (
        <h3 id={`sources-${p.draftId}`} className="font-semibold">
          {p.sources.heading}
        </h3>
      )}
      {p.sources.note === null ? null : <p className="text-sm">{p.sources.note}</p>}
      {p.sources.entries.length === 0 ? null : (
        <form className="filter" aria-label={copy("calendar.sources.filter.label")}>
          {(["all", "site", "public"] as const).map((kind) => (
            <input
              key={kind}
              type="radio"
              name={`sources-shown-${p.draftId}`}
              className={`btn btn-sm ${kind === "all" ? "filter-reset" : ""}`}
              aria-label={copy(`calendar.sources.filter.${kind}`)}
              checked={shown === kind}
              onChange={() => setShown(kind)}
            />
          ))}
        </form>
      )}
      {entries.length === 0 ? null : (
        <ol className="list min-w-0">
          {entries.map((entry) => (
            <Entry key={entry.url} entry={entry} id={`source-${p.draftId}-${entry.n ?? entry.url}`} picked={entry.n !== null && entry.n === p.picked} {...(p.onShow === undefined ? {} : { onShow: p.onShow })} />
          ))}
        </ol>
      )}
      {p.sources.foot === null ? null : <p className="text-xs text-base-content/70">{p.sources.foot}</p>}
    </section>
  );
}

/** The article with its numbers, the swap to its sources and, on a phone, the sheet a number opens. */
export function SourcedBody(p: { sources: SourcesModel; draftId: string; label: string; children: React.ReactNode }): React.JSX.Element {
  const [list, setList] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const [shown, setShown] = useState<Shown>("all");
  const article = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const from = useRef<HTMLElement | null>(null);
  const focus = useRef<string | null>(null);

  useEffect(() => {
    if (focus.current === null) return;
    document.getElementById(focus.current)?.focus();
    focus.current = null;
  });
  useEffect(() => {
    if (sheet !== null) dialog.current?.showModal();
  }, [sheet]);

  function mark(n: number | null): HTMLElement | null {
    const sentences = Array.from(article.current?.querySelectorAll<HTMLElement>("[data-cites]") ?? []);
    for (const sentence of sentences) sentence.classList.remove(...MARKED);
    const hit = n === null ? [] : sentences.filter((sentence) => sentence.dataset.cites === String(n));
    for (const sentence of hit) sentence.classList.add(...MARKED);
    return hit[0] ?? null;
  }

  function pick(event: React.MouseEvent<HTMLElement>): void {
    const number = (event.target as Element).closest<HTMLElement>("[data-source]");
    const n = Number(number?.dataset.source);
    if (number === null || !Number.isInteger(n)) return;
    from.current = number;
    if (window.matchMedia(SWAPS).matches) {
      // A filtered list may not hold the picked entry.
      setShown("all");
      setPicked(n);
      setList(true);
      focus.current = `source-${p.draftId}-${n}`;
    } else setSheet(n);
  }

  function show(n: number): void {
    setList(false);
    setPicked(n);
    // The article is drawn again before its first marked sentence can take the focus.
    requestAnimationFrame(() => mark(n)?.focus());
  }

  function clear(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Escape" || picked === null) return;
    setPicked(null);
    mark(null);
  }

  const entry = sheet === null ? undefined : p.sources.entries.find((e) => e.n === sheet);
  return (
    // No box of its own: the summary and the scroller sit in the pane's card body, which scrolls on a short screen.
    <div className="contents" onKeyDown={clear}>
      {p.sources.summary === null && p.sources.toggle === null ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {p.sources.summary === null ? null : <p className="min-w-0 flex-1 text-sm text-base-content/70" data-testid="sources-summary">{p.sources.summary}</p>}
          {p.sources.toggle === null ? null : (
            <button type="button" className="btn btn-soft btn-sm max-sm:hidden" aria-pressed={list} onClick={() => setList(!list)} data-testid="sources-toggle">
              <Quote aria-hidden className="size-4" />
              {p.sources.toggle}
            </button>
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-4 border-t border-base-300 pt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" tabIndex={0} aria-label={p.label} data-testid="day-body">
        <div ref={article} className={`prose min-w-0 max-w-none ${list ? "hidden" : ""}`} onClick={pick}>
          {p.children}
        </div>
        {/* From `sm` the list takes the article's place; below it, or with nothing to swap to, it follows the article. */}
        <div className={list || p.sources.toggle === null ? "" : "sm:hidden"}>
          <PageSources sources={p.sources} draftId={p.draftId} picked={picked} onShow={show} shown={shown} onShown={setShown} />
        </div>
      </div>
      <dialog
        ref={dialog}
        className="modal modal-bottom"
        aria-label={entry?.name ?? undefined}
        onClose={() => {
          setSheet(null);
          from.current?.focus();
        }}
      >
        <div className="modal-box min-w-0">
          {entry === undefined ? null : (
            <ol className="list min-w-0">
              <Entry entry={entry} id={`source-sheet-${p.draftId}`} picked={false} />
            </ol>
          )}
          <form method="dialog" className="modal-action">
            <button type="submit" className="btn btn-sm">
              {copy("calendar.sources.close")}
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
