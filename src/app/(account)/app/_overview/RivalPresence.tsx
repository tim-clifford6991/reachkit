// SPEC §4 (board AppCompetitors) — the counting cards on the Competitors tab:
// who holds the top result on each of the twelve, who is on their first page,
// and who AI answers mention over the month's reputation reading. Each is "a
// name-and-value line with a **full-width** bar under it" (#917).
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
import Link from "next/link";
import { PresenceBars, type PresenceBar } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatCount } from "./present";
import type { PresenceCard, TopCard } from "./rivals-model";

const INK = "text-base-content/70";
const TITLE = {
  top: "overview.rivals.first.title",
  firstPage: "overview.rivals.first-page.title",
  named: "overview.rivals.named.title",
} as const satisfies Record<string, CopyKey>;

function Card(p: {
  titleKey: CopyKey;
  testId: string;
  lead: string;
  /** `null` where the pass read nothing for it: its written line, and no bars. */
  bars: { you: PresenceBar; rivals: readonly PresenceBar[]; of: number } | null;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <h2 className="card-title text-base">{copy(p.titleKey)}</h2>
        <p className={`max-w-prose text-sm ${INK}`}>{p.lead}</p>
        {p.bars === null ? (
          <p className={`text-sm ${INK}`} data-testid={`${p.testId}-unmeasured`}>
            {copy("overview.rivals.card.unmeasured")}
          </p>
        ) : (
          <PresenceBars you={p.bars.you} rivals={p.bars.rivals} measured={p.bars.of} label={copy(p.titleKey)} />
        )}
        {p.children}
      </div>
    </section>
  );
}

/** A presence card's bars, each with its bare count; no rival bars where none was counted. */
function barsOf(card: PresenceCard): { you: PresenceBar; rivals: readonly PresenceBar[]; of: number } | null {
  if (card.of === 0) return null;
  const bar = (name: string, value: number): PresenceBar => ({ name, value, text: formatCount(value) });
  return {
    you: bar(copy("overview.prompts.share.you"), card.you.count),
    rivals: card.noRival ? [] : card.rivals.map((row) => bar(row.domain, row.count)),
    of: card.of,
  };
}

export function RivalPresence(p: {
  top: TopCard;
  /** The line under the top results, with how many this week's pages go after. */
  topLine: string;
  firstPage: PresenceCard;
  startedLine: string | null;
  noRivalOnFirstPage: string;
  named: PresenceCard;
  namedLead: string;
  noRivalNamed: string;
  answersHref: string;
}): React.JSX.Element {
  const of = formatCount(p.top.of);
  const top = (name: string, value: number): PresenceBar => ({ name, value, text: copy("overview.rivals.first.of", { n: formatCount(value), of }) });
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="rivals-presence">
      <Card
        titleKey={TITLE.top}
        testId="rivals-card-top"
        lead={copy("overview.rivals.first.lead", { of })}
        bars={
          p.top.of === 0
            ? null
            : {
                you: top(copy("overview.prompts.share.you"), p.top.you),
                rivals: [
                  ...p.top.holders.map((row) => top(row.domain, row.count)),
                  ...(p.top.others === 0 ? [] : [top(copy("overview.rivals.first.others"), p.top.others)]),
                ],
                of: p.top.of,
              }
        }
      >
        {p.top.of === 0 ? null : (
          <p className="rounded-box bg-base-200 p-3 text-sm" data-testid="rivals-top-line">
            {p.topLine}
          </p>
        )}
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card
          titleKey={TITLE.firstPage}
          testId="rivals-card-first-page"
          lead={copy("overview.rivals.first-page.lead", { of: formatCount(p.firstPage.of) })}
          bars={barsOf(p.firstPage)}
        >
          {p.firstPage.noRival ? (
            <p className={`text-sm wrap-anywhere ${INK}`} data-testid="rivals-card-first-page-no-rival">
              {p.noRivalOnFirstPage}
            </p>
          ) : null}
          {p.startedLine === null ? null : (
            <p className={`text-xs ${INK}`} data-testid="rivals-started">
              {p.startedLine}
            </p>
          )}
        </Card>

        <Card titleKey={TITLE.named} testId="rivals-card-named" lead={p.namedLead} bars={barsOf(p.named)}>
          {p.named.noRival ? (
            <p className={`text-sm wrap-anywhere ${INK}`} data-testid="rivals-card-named-no-rival">
              {p.noRivalNamed}
            </p>
          ) : null}
          {/* The count and the answers it was counted from are one reading, and this is the way through to them. */}
          <Link href={p.answersHref} prefetch={true} className="link link-primary text-xs" data-testid="rivals-see-answers">
            {copy("overview.rivals.named.see-all")}
          </Link>
        </Card>
      </div>
    </div>
  );
}
