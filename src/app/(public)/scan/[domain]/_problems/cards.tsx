// BUILD §4.1 module 3 — the three problem cards
//
// Count, severity in words, who does the work, and the paste block on the
// one arm that carries lines. Rendered from `model.ts`'s three-tuple and
// from nothing else, so this file cannot reach a report field the model
// did not hand it.
//
// daisyUI in the route (DESIGN rule 1): each problem is a `card` with a
// severity `badge` and a who-does-it `badge`. The tone rides beside the word
// and never instead of it.
//
// A count that could not be measured shows the dash for the count *and*
// for the severity, carries the reason-specific written line, and holds no
// lines to paste — a founder is never shown a robots directive derived
// from a measurement that did not happen.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { SEVERITY } from "@/lib/presentation/bands";
import { dash, MeasuredNum, measuredText } from "../_address/measured";
import type { Measured } from "@/lib/measure/measured";
import { SEVERITY_INDEX, type ProblemCard, type Severity } from "./model";
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

function PasteBlock(p: { lines: readonly string[] }): React.JSX.Element {
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

/** A total switch over `Fix`, so a new arm fails the build until it has a
 *  rendering. The `paste` arm is the only one that carries lines, and the
 *  copy control is the only control on any fix. */
function FixBody(p: { card: ProblemCard }): React.JSX.Element | null {
  const { fix } = p.card;
  switch (fix.kind) {
    case "none_needed":
      return <p className="text-sm">{copy(p.card.noneNeeded)}</p>;
    case "unknown": {
      const rendered = measuredText(p.card.count, copy(p.card.title));
      return rendered.line === undefined ? null : <p className="text-sm">{rendered.line}</p>;
    }
    case "paste":
      return <PasteBlock lines={fix.lines} />;
    case "we_write":
    case "we_rewrite":
      return null;
    default: {
      const exhaustive: never = fix;
      return exhaustive;
    }
  }
}

function ProblemCardView(p: { card: ProblemCard }): React.JSX.Element {
  const { card } = p;
  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-3">
        <h3 className="card-title text-base">{copy(card.title)}</h3>
        <div className="flex flex-wrap gap-2">
          <SeverityBadge severity={card.severity} />
          <span className="badge badge-primary badge-outline">{copy(card.doer)}</span>
        </div>
        <div className="text-4xl font-semibold">
          <MeasuredNum value={card.count} what={copy(card.title)} />
        </div>
        <FixBody card={card} />
      </div>
    </section>
  );
}

/** Exactly three, in `PROBLEM_ORDER`. The props are the tuple and nothing
 *  else; there is no field here that could hold a page, a title or a URL,
 *  so "neither lists nor previews the pages themselves" holds by
 *  construction. */
export function ProblemCards(p: {
  cards: readonly [ProblemCard, ProblemCard, ProblemCard];
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      {p.cards.map((card) => (
        <ProblemCardView key={card.problem} card={card} />
      ))}
    </div>
  );
}

/** SPEC §9's eight checks. A check that was not run, or ran and could not
 *  measure, is absent with one why-line: no figure, no severity, no dash, and
 *  never "Nothing to fix". The who-does-it badge is the ruling's and is
 *  always shown. */
function CheckCardView(p: { card: CheckCard }): React.JSX.Element {
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
  return (
    <section className="card bg-base-100 border-base-300 border" data-check={card.check}>
      <div className="card-body gap-3">
        <h3 className="card-title text-base">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {measured === null ? null : <SeverityBadge severity={measured.severity} />}
          <span className="badge badge-primary badge-outline">{copy(card.doer)}</span>
        </div>
        {measured === null ? null : (
          <div className="text-4xl font-semibold">
            <MeasuredNum value={measured.count} what={title} />
          </div>
        )}
        {why === undefined ? null : <p className="text-sm">{why}</p>}
        {fix.kind === "none_needed" ? <p className="text-sm">{copy("check.none-needed")}</p> : null}
        {fix.kind === "paste" ? <PasteBlock lines={fix.lines} /> : null}
      </div>
    </section>
  );
}

export function CheckCards(p: { cards: readonly CheckCard[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-4">
      {p.cards.map((card) => (
        <CheckCardView key={card.check} card={card} />
      ))}
    </div>
  );
}
