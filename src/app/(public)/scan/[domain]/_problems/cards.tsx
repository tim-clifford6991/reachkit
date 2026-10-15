// BUILD §4.1 module 3 — the three problem cards, and the eight quick checks
//
// Board `R12-2-Report` (#1068): the three costliest problems are equal-height
// clickable cards — icon, count, title, one-line cause, badges, a *show me*
// link — and the eight checks are one two-column list. Rendered from
// `model.ts`'s three-tuple and `checks.ts`'s cards and from nothing else, so
// this file cannot reach a report field the model did not hand it.
//
// daisyUI in the route (DESIGN rule 1): `card`, `badge`, `status`, `list`.
// The tone rides beside the word and never instead of it.
//
// A count that could not be measured shows the dash for the count *and*
// for the severity, carries the reason-specific written line, and holds no
// lines to paste — a founder is never shown a robots directive derived
// from a measurement that did not happen. The robots lines themselves sit
// behind the card's link, in the method section (`method.tsx`).
import type React from "react";
import { ArrowRight, FileText, Lock, MessageSquareQuote, type LucideIcon } from "lucide-react";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SEVERITY } from "@/lib/presentation/bands";
import { dash, MeasuredNum, measuredText } from "../_address/measured";
import type { Measured } from "@/lib/measure/measured";
import { SEVERITY_INDEX, type ProblemCard, type ProblemName, type Severity } from "./model";
import type { CheckCard } from "./checks";
import { CopyLines } from "./copy-lines";

/** Red only for the customer's own problem being shown to them — which is
 *  exactly what a `high` severity is. */
const SEVERITY_BADGE: Readonly<Record<Severity, string>> = Object.freeze({
  low: "badge-success",
  mid: "badge-warning",
  high: "badge-error",
});

function SeverityBadge(p: { severity: Measured<Severity> }): React.JSX.Element {
  const { severity } = p;
  if (severity.kind === "unmeasured") {
    return <span className="badge badge-ghost">{dash()}</span>;
  }
  const level = severity.value;
  return (
    <span className={`badge ${SEVERITY_BADGE[level]}`}>
      {copy(SEVERITY[SEVERITY_INDEX[level]])}
    </span>
  );
}

export function PasteBlock(p: { lines: readonly string[] }): React.JSX.Element {
  return (
    <>
      <pre className="bg-base-200 rounded-box min-w-0 overflow-x-auto p-3 text-xs">
        <code className="num">{p.lines.join("\n")}</code>
      </pre>
      <div className="card-actions">
        <CopyLines lines={p.lines} />
      </div>
    </>
  );
}

/** Where each card's link goes, and what it says. `method-…` is the
 *  content of that problem's method section, so following it opens the
 *  collapse it sits in; `first-page` is the free page card. */
export const METHOD_ANCHOR: Readonly<Record<ProblemName, string>> = Object.freeze({
  blocked_readers: "method-blocked-readers",
  missing_pages: "method-missing-pages",
  unquotable_pages: "method-unquotable-pages",
});
export const FIRST_PAGE_ANCHOR = "first-page";

const PROBLEM_ICON: Readonly<Record<ProblemName, LucideIcon>> = Object.freeze({
  blocked_readers: Lock,
  missing_pages: FileText,
  unquotable_pages: MessageSquareQuote,
});

const PROBLEM_CAUSE: Readonly<Record<ProblemName, CopyKey>> = Object.freeze({
  blocked_readers: "problem.blocked-readers.cause",
  missing_pages: "problem.missing-pages.cause",
  unquotable_pages: "problem.unquotable-pages.cause",
});

/** The icon tile takes the severity's tone; unmeasured is quiet. */
const ICON_TONE: Readonly<Record<Severity, string>> = Object.freeze({
  low: "bg-success/10 text-success",
  mid: "bg-warning/10 text-warning",
  high: "bg-error/10 text-error",
});

/** The one line under the title: the cause where there is something to
 *  fix, "Nothing to fix" on a measured zero, the reason on the dash. */
function CardLine(p: { card: ProblemCard }): React.JSX.Element | null {
  const { card } = p;
  switch (card.fix.kind) {
    case "none_needed":
      return <p className="text-base-content/70 text-sm">{copy(card.noneNeeded)}</p>;
    case "unknown": {
      const rendered = measuredText(card.count, copy(card.title));
      return rendered.line === undefined ? null : <p className="text-base-content/70 text-sm">{rendered.line}</p>;
    }
    case "paste":
    case "we_write":
    case "we_rewrite":
      return <p className="text-base-content/70 text-sm">{copy(PROBLEM_CAUSE[card.problem])}</p>;
    default: {
      const exhaustive: never = card.fix;
      return exhaustive;
    }
  }
}

/** The card's link: the robots lines where the paste arm has any, the free page for
 *  the pages ReachKit writes when there is one, and the method otherwise. */
function linkOf(card: ProblemCard, firstPage: boolean): { href: string; label: CopyKey } {
  if (card.fix.kind === "paste" && card.fix.lines.length > 0) return { href: `#${METHOD_ANCHOR[card.problem]}`, label: "problem.show.lines" };
  if (card.fix.kind === "we_write" && firstPage) return { href: `#${FIRST_PAGE_ANCHOR}`, label: "problem.show.first-page" };
  return { href: `#${METHOD_ANCHOR[card.problem]}`, label: "problem.show.method" };
}

function ProblemCardView(p: { card: ProblemCard; firstPage: boolean }): React.JSX.Element {
  const { card } = p;
  const Icon = PROBLEM_ICON[card.problem];
  const tone = card.severity.kind === "unmeasured" ? "bg-base-200 text-base-content/70" : ICON_TONE[card.severity.value];
  const link = linkOf(card, p.firstPage);
  return (
    <a href={link.href} className={`card bg-base-100 shadow-(--shadow-card) h-full min-w-0 ${CARD_LIFT}`}>
      <div className="card-body gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-field grid size-9 place-items-center ${tone}`}>
            <Icon size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-3xl leading-none">
            <MeasuredNum value={card.count} what={copy(card.title)} figure />
          </span>
        </div>
        <h3 className="text-base font-semibold">{copy(card.title)}</h3>
        <CardLine card={card} />
        <div className="mt-auto flex flex-wrap gap-2">
          <SeverityBadge severity={card.severity} />
          <span className="badge badge-soft badge-primary">{copy(card.doer)}</span>
        </div>
        <span className="text-primary flex items-center gap-1 text-sm font-semibold">
          {copy(link.label)}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden className={ARROW_NUDGE} />
        </span>
      </div>
    </a>
  );
}

/** Exactly three, in `PROBLEM_ORDER`, stretched to one height. The props
 *  are the tuple and whether the report has a first page to point at; there
 *  is no field here that could hold a page, a title or a URL, so "neither
 *  lists nor previews the pages themselves" holds by construction. */
export function ProblemCards(p: {
  cards: readonly [ProblemCard, ProblemCard, ProblemCard];
  firstPage?: boolean;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {p.cards.map((card) => (
        <ProblemCardView key={card.problem} card={card} firstPage={p.firstPage === true} />
      ))}
    </div>
  );
}

/** A check's dot: its severity's tone where it was measured, grey where it
 *  could not run or could not measure — the legend under the list says what
 *  grey means, and the row says it to a screen reader. */
const STATUS_TONE: Readonly<Record<Severity, string>> = Object.freeze({
  low: "status-success",
  mid: "status-warning",
  high: "status-error",
});

/** SPEC §9's eight checks, one row each. A check that was not run, or ran
 *  and could not measure, has a grey dot and its why-line for a screen
 *  reader: no figure, no severity, no dash, and never "Nothing to fix". The
 *  who-does-it badge is the ruling's and is always shown; where the row is
 *  too narrow for the name and the badge, the badge takes the next line. A
 *  check with lines to paste opens them under its row. */
function CheckRow(p: { card: CheckCard }): React.JSX.Element {
  const { card } = p;
  const title = copy(card.title);
  const { fix, reading } = card;
  const measured = reading !== null && reading.count.kind !== "unmeasured" ? reading : null;
  const why =
    fix.kind === "not_run"
      ? copy("check.not-run")
      : fix.kind === "unknown" && reading !== null
        ? measuredText(reading.count, title).line
        : undefined;
  const tone =
    measured === null || measured.severity.kind === "unmeasured" ? "" : STATUS_TONE[measured.severity.value];
  // What the dot says, for a reader that cannot see its colour: the why-line
  // where there is no reading, "Nothing to fix" on a zero, the severity
  // word otherwise.
  const said =
    why ??
    (fix.kind === "none_needed"
      ? copy("check.none-needed")
      : measured !== null && measured.severity.kind !== "unmeasured"
        ? copy(SEVERITY[SEVERITY_INDEX[measured.severity.value]])
        : undefined);
  const row = (
    <>
      <span className={`status status-lg shrink-0 ${tone}`}>
        {said === undefined ? null : <span className="sr-only">{said}</span>}
      </span>
      <span className="flex flex-1 flex-wrap items-baseline gap-x-2 text-sm font-medium">
        <span>{title}</span>
        {measured === null ? null : (
          <span className="text-base-content/70">
            <MeasuredNum value={measured.count} what={title} />
          </span>
        )}
      </span>
      <span className="badge badge-soft badge-primary badge-sm ml-auto shrink-0">{copy(card.doer)}</span>
    </>
  );
  return (
    <li className="border-base-200 border-b py-3 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0" data-check={card.check}>
      {fix.kind === "paste" ? (
        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
            {row}
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <PasteBlock lines={fix.lines} />
          </div>
        </details>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{row}</div>
      )}
    </li>
  );
}

export function CheckCards(p: { cards: readonly CheckCard[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <section className="card bg-base-100 shadow-(--shadow-card)">
        <ul className="grid grid-cols-1 gap-x-10 px-5 py-2 md:grid-cols-2">
          {p.cards.map((card) => (
            <CheckRow key={card.check} card={card} />
          ))}
        </ul>
      </section>
      <p className="text-base-content/70 flex flex-wrap gap-x-1 text-xs">
        <span>{copy("check.legend")}</span>
        <a href="#method" className="link link-primary font-semibold">
          {copy("method.title")}
        </a>
      </p>
    </div>
  );
}
