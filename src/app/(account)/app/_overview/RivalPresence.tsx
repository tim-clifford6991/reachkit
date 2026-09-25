// SPEC §4 (2026-09-20, #908) — the two counting cards on the Rivals tab.
//
// "Who is on the first page for the twelve searches, who the three answer
// engines name." #917 states the shape of each one: "a name-and-value line
// with a **full-width** bar under it".
//
// **`PresenceBars` is Recharts and already exists** (`src/ui/charts`, #550;
// DESIGN rule 2). It draws rivals first and the customer last in the
// accent, holds every bar to the same denominator rather than to the
// longest bar, and carries an `sr-only` list of the same readings — so
// nothing here is a second bar component and nothing here is colour-alone.
//
// This card was built with daisyUI `progress` for one day, because the
// component put each row's name in a `YAxis` beside the bar and, measured
// in Chromium at 390, drew those labels **115px outside the chart's own
// surface**, clipped: `bigcompetitor.com` reached the customer cut in half.
// #943 found the same defect on the free report and #955 fixed it in the
// component — each label is now its own line above a full-width bar, which
// is docs/DESIGN.md's rule verbatim and exactly the shape #917 asks for. So
// this card uses the component, and the hand-rolled bars went with the
// reason for them. One implementation of an occupancy bar in the product,
// not two.
//
// **A card whose reading was never taken draws no bars at all.** `of === 0`
// is "the pass read none of the twelve", not "every rival scored zero", and
// four empty tracks would say the second. The card states its written line
// instead — REQ-004, at the card level.
import type React from "react";
import { PresenceBars } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatCount } from "./present";
import type { PresenceCard } from "./rivals-model";

/**
 * The two cards' handles, as module constants.
 *
 * Not written at the call site: a `CopyKey` spelled as a JSX attribute is a
 * string literal on a surface, which is the one thing REQ-093's sweep
 * exists to stop (`search-words.ts` records the same rule for the Search
 * tab's four tiles). Here the keys are values, and the JSX passes them.
 */
const CARD = Object.freeze({
  firstPage: {
    titleKey: "overview.rivals.first-page.title",
    testId: "rivals-card-first-page",
  },
  named: {
    titleKey: "overview.rivals.named.title",
    testId: "rivals-card-named",
  },
}) satisfies Readonly<Record<string, { titleKey: CopyKey; testId: string }>>;

/** One card: its name, one line saying what the count is of, the bars, and
 *  whatever the caller puts beneath them. */
function Card(p: {
  titleKey: CopyKey;
  testId: string;
  lead: string;
  card: PresenceCard;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <h2 className="card-title text-base">{copy(p.titleKey)}</h2>
        <p className="max-w-prose text-sm text-base-content/70">{p.lead}</p>
        {p.card.of === 0 ? (
          <p className="text-sm text-base-content/70" data-testid={`${p.testId}-unmeasured`}>
            {copy("overview.rivals.card.unmeasured")}
          </p>
        ) : (
          <PresenceBars
            you={{ name: p.card.you.domain, value: p.card.you.count }}
            rivals={p.card.rivals.map((row) => ({ name: row.domain, value: row.count }))}
            measured={p.card.of}
            label={copy(p.titleKey)}
          />
        )}
        {p.children}
      </div>
    </section>
  );
}

export function RivalPresence(p: {
  firstPage: PresenceCard;
  named: PresenceCard;
  /** Where the customer stood when they started, already written by the
   *  caller — `null` where there is no earlier week to have started from. */
  startedLine: string | null;
  /** The three engines the second card counts over, already written. */
  enginesLine: string;
  /** Where "See every answer" goes — the AI answers tab, which draws every
   *  one of the cells this card counts. */
  answersHref: string;
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2" data-testid="rivals-presence">
      <Card
        titleKey={CARD.firstPage.titleKey}
        testId={CARD.firstPage.testId}
        lead={copy("overview.rivals.first-page.lead", { of: formatCount(p.firstPage.of) })}
        card={p.firstPage}
      >
        {p.startedLine === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="rivals-started">
            {p.startedLine}
          </p>
        )}
      </Card>

      <Card
        titleKey={CARD.named.titleKey}
        testId={CARD.named.testId}
        lead={p.enginesLine}
        card={p.named}
      >
        {/* The count and the cells it was counted from are one reading, and
            this is the way through to them. */}
        <a href={p.answersHref} className="link link-primary text-xs" data-testid="rivals-see-answers">
          {copy("overview.rivals.named.see-all")}
        </a>
      </Card>
    </div>
  );
}
