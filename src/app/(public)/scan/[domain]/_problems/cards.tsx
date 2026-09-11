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
import { Badge, Btn } from "@/ui/components";
import { ProblemCard as ProblemCardShell, type ProblemCardEdge } from "@/ui/idiom";
import type { Tone } from "@/ui/types";
import { copy } from "@/lib/presentation/copy";
import { SEVERITY } from "@/lib/presentation/bands";
import { dash, MeasuredNum, measuredText } from "../_address/measured";
import { SEVERITY_INDEX, type ProblemCard, type Severity } from "./model";

/** Red appears only for the customer's own problem being shown to them
 *  (`SPEC.md` §2.5) — which is exactly what a `high` severity is. */
const SEVERITY_TONE: Readonly<Record<Severity, Tone>> = Object.freeze({
  low: "ok",
  mid: "warn",
  high: "bad",
});

/** `SPEC.md` §4.1 module 3: "Left border color = severity." The border is
 *  never the only carrier of the level — `SeverityBadge` renders the word
 *  beside it, always — so this is a second reading of the same fact, which
 *  is what §2.5 asks a colour to be. An unmeasured severity gets the
 *  neutral edge, because a dash is not a level. */
const SEVERITY_EDGE: Readonly<Record<Severity, ProblemCardEdge>> = Object.freeze({
  low: "ok",
  mid: "warn",
  high: "bad",
});
const UNMEASURED_EDGE: ProblemCardEdge = "neutral";

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
 *  rendering. The `paste` arm is the only one that carries lines — they are
 *  the card's code block, handed to `ProblemCard` below — and the copy
 *  control is the only control on any fix. */
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
      return <Btn label={copy("problem.paste.label")} size="sm" />;
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
  const edge =
    card.severity.kind === "unmeasured" ? UNMEASURED_EDGE : SEVERITY_EDGE[card.severity.value];
  // UI-SPEC §2's own row for this component: "title · severity badge ·
  // who-does-it badge · count · optional code block" — the idiom's
  // `ProblemCard` (#487), whose edge and code block are token-driven. The
  // two badges are ruling 9a's pair: the severity word **and** the
  // who-does-it badge together. The count is the ladder's `--h1`, the one
  // headline number of this module.
  return (
    <ProblemCardShell
      title={copy(card.title)}
      edge={edge}
      badges={
        <>
          <SeverityBadge card={card} />
          <Badge tone="accent">{copy(card.doer)}</Badge>
        </>
      }
      count={<MeasuredNum value={card.count} what={copy(card.title)} />}
      code={card.fix.kind === "paste" ? card.fix.lines : undefined}
    >
      <FixBody card={card} />
    </ProblemCardShell>
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
    <div className="grid grid-cols-1 gap-[var(--s-4)] lg:grid-cols-3">
      {p.cards.map((card) => (
        <ProblemCardView key={card.problem} card={card} />
      ))}
    </div>
  );
}
