// BUILD §4.1 module 3 — the three problem cards
//
// Count, severity in words, who does the work, and the paste block on the
// one arm that carries lines. Rendered from `model.ts`'s three-tuple and
// from nothing else, so this file cannot reach a report field the model
// did not hand it.
//
// The severity word is `SEVERITY[SEVERITY_INDEX[level]]` —
// `src/lib/presentation/bands.ts` declares `SEVERITY` as an ordered triple
// ascending in the count, not a record keyed by the handle, so
// `SEVERITY[level]` does not type-check and the ordering has exactly one
// home. The tone rides beside the word and never instead of it: a severity
// shown in colour alone would be unreadable to a reader who cannot see the
// colour, and REQ-004 c4's rule against that is general.
//
// A count that could not be measured shows the dash for the count *and*
// for the severity, carries the reason-specific written line, and holds no
// lines to paste — a founder is never shown a robots directive derived
// from a measurement that did not happen.
import type React from "react";
import { Badge, Btn, Card } from "@/ui/components";
import { CardHead } from "@/ui/idiom";
import type { Tone } from "@/ui/types";
import { copy } from "@/lib/presentation/copy";
import { SEVERITY } from "@/lib/presentation/bands";
import { dash, MeasuredNum, measuredText } from "../_address/measured";
import { SEVERITY_INDEX, type ProblemCard, type Severity } from "./model";

/** Red appears only for the customer's own problem being shown to them
 *  (`BUILD.md` §2.5) — which is exactly what a `high` severity is. */
const SEVERITY_TONE: Readonly<Record<Severity, Tone>> = Object.freeze({
  low: "ok",
  mid: "warn",
  high: "bad",
});

/** `BUILD.md` §4.1 module 3: "Left border color = severity." The border is
 *  never the only carrier of the level — `SeverityBadge` renders the word
 *  beside it, always — so this is a second reading of the same fact, which
 *  is what §2.5 asks a colour to be. An unmeasured severity gets the
 *  neutral edge, because a dash is not a level. */
const SEVERITY_EDGE: Readonly<Record<Severity, string>> = Object.freeze({
  low: "border-l-success",
  mid: "border-l-warning",
  high: "border-l-error",
});
const UNMEASURED_EDGE = "border-l-base-300";

function SeverityBadge(p: { card: ProblemCard }): React.JSX.Element {
  const { severity } = p.card;
  if (severity.kind === "unmeasured") {
    return <Badge tone="neutral">{dash()}</Badge>;
  }
  const level = severity.value;
  return (
    <Badge tone={SEVERITY_TONE[level]}>
      {copy(SEVERITY[SEVERITY_INDEX[level]])}
    </Badge>
  );
}

/** A total switch over `Fix`, so a new arm fails the build until it has a
 *  rendering. The `paste` arm is the only one that carries lines, and the
 *  copy control is the only control on any fix. */
function FixBody(p: { card: ProblemCard }): React.JSX.Element | null {
  const { fix } = p.card;
  switch (fix.kind) {
    case "none_needed":
      return <p>{copy(p.card.noneNeeded)}</p>;
    case "unknown": {
      const rendered = measuredText(p.card.count, copy(p.card.title));
      return rendered.line === undefined ? null : <p>{rendered.line}</p>;
    }
    case "paste":
      return (
        <div className="flex flex-col gap-2">
          <pre className="bg-base-200 border-base-300 overflow-x-auto rounded border p-3 text-xs">
            <code className="num">{fix.lines.join("\n")}</code>
          </pre>
          <Btn label={copy("problem.paste.label")} size="sm" />
        </div>
      );
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
  const edge =
    p.card.severity.kind === "unmeasured"
      ? UNMEASURED_EDGE
      : SEVERITY_EDGE[p.card.severity.value];
  return (
    // `[&>*]:h-full` makes the card fill the wrapper the grid stretched to
    // the row's height. Without it the coloured edge runs the full row
    // while the card it belongs to stops short, and the severity reads as
    // a rule beside empty space rather than as this card's own edge.
    <div className={`rounded-box overflow-hidden border-l-4 [&>*]:h-full ${edge}`}>
      <Card
        state="default"
        title={<CardHead eyebrow={copy(p.card.title)} pill={<SeverityBadge card={p.card} />} />}
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="text-3xl font-bold">
            <MeasuredNum value={p.card.count} what={copy(p.card.title)} />
          </div>
          <Badge tone="accent">{copy(p.card.doer)}</Badge>
        </div>
        <FixBody card={p.card} />
      </Card>
    </div>
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {p.cards.map((card) => (
        <ProblemCardView key={card.problem} card={card} />
      ))}
    </div>
  );
}
