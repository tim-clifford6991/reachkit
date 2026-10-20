// Issue 1553 — how far this live page has got toward being found.
//
// published → crawled → indexed → shown → placed → cited, as daisyUI
// `steps` with one-word labels (docs/DESIGN.md). A step reached is
// `step-primary`; a step a source can read but has not seen yet is drawn
// plain; a step nothing ReachKit reads can tell is not drawn at all, so
// "not verified" never reads as "not indexed". Every value is the ladder
// `@/lib/measure/ladder` decided from stored rows; this file decides
// nothing.
//
// A note under the page, so it starts closed under its title (SPEC §7,
// 2026-10-07, issue 1325), in the classes `_overview/present.ts` spells.
// Vertical on a phone and in a row from `md`, so six labels never overflow.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SEARCH_READING_WINDOW_D } from "@/lib/config/constants";
import type { Ladder } from "@/lib/measure/ladder";
import { CLOSED, formatCount } from "../../_overview/present";
import { NOTE } from "./ReviewCards";

export function FoundSteps(p: { ladder: Ladder }): React.JSX.Element {
  const { ladder } = p;
  const steps: { key: CopyKey; reached: boolean | null }[] = [
    { key: "record.ladder.published", reached: true },
    { key: "record.ladder.crawled", reached: ladder.crawled },
    { key: "record.ladder.indexed", reached: ladder.indexed },
    { key: "record.ladder.impressions", reached: ladder.showing },
    { key: "record.ladder.place", reached: ladder.bestPlace !== null ? true : ladder.showing === null ? null : false },
    { key: "record.ladder.cited", reached: ladder.cited },
  ];
  const lines = [
    ladder.impressions === null
      ? null
      : copy("record.ladder.shown", { count: formatCount(ladder.impressions), days: formatCount(SEARCH_READING_WINDOW_D) }),
    ladder.bestPlace === null
      ? null
      : copy(ladder.placeSource === "labs" ? "record.ladder.best.labs" : "record.ladder.best", { place: formatCount(ladder.bestPlace) }),
  ].filter((line): line is string => line !== null);

  return (
    <section className={NOTE.card} data-testid="draft-found">
      <div className={NOTE.pad}>
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className="eyebrow">{copy("record.ladder.title")}</h2>
          </summary>
          <div className={CLOSED.body}>
            <div className={NOTE.inner}>
              <ul className="steps steps-vertical md:steps-horizontal min-w-0 text-sm">
                {steps
                  .filter((step) => step.reached !== null)
                  .map((step) => (
                    <li
                      key={step.key}
                      className={`step${step.reached === true ? " step-primary" : ""}`}
                      data-reached={step.reached === true ? "yes" : "not-yet"}
                    >
                      {copy(step.key)}
                    </li>
                  ))}
              </ul>
              {lines.map((line) => (
                <p key={line} className="num num-phrase text-sm text-base-content/70">
                  {line}
                </p>
              ))}
              <p className="text-xs text-base-content/70">{copy("record.ladder.note")}</p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
