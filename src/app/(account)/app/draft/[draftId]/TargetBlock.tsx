// SPEC §7 — why this page was written, and the search it is for (board
// `AppDraft`): the week's reason in words, then one closed line naming the
// search, how often it is searched and who answers it today. Every value was
// stored on the opportunity when the page was chosen; nothing is re-measured.
import type React from "react";
import { ChevronDown, Search } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { whyLineOf } from "../../calendar/card-lines";
import { targetReadings } from "../../calendar/TargetRows";
import type { DraftTarget } from "./model";
import { NOTE } from "./ReviewCards";

const FIT_COPY = Object.freeze({
  answer: "draft.why.fit.answer",
  helps: "draft.why.fit.helps",
} as const);

type Target = Extract<DraftTarget, { kind: "target" }>;

/** The reason lines a target carries: the week's stored reason, then the fit. */
function reasonLines(target: Target): string[] {
  const why = target.why;
  const lines: string[] = [];
  const planned = whyLineOf(why?.planReason);
  if (planned !== null) lines.push(planned);
  if (why?.fit != null) lines.push(copy(FIT_COPY[why.fit]));
  return lines;
}

function SearchRows(p: { target: Target }): React.JSX.Element {
  const facts = p.target.target;
  const { volume } = targetReadings(facts);
  const rival = p.target.why?.rival ?? null;
  return (
    // A quiet link that opens in place, as Plan's: no box, a chevron that turns.
    <details className="collapse group min-w-0 rounded-none" data-testid="draft-search">
      <summary className="collapse-title link link-primary flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 p-0 text-sm font-semibold no-underline [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        {copy("draft.search.title")}
      </summary>
      <dl className="collapse-content grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 p-0 text-sm">
        <dt className="text-base-content/70">{copy("draft.search.query")}</dt>
        <dd className="num min-w-0 wrap-anywhere">{facts.search}</dd>
        <dt className="text-base-content/70">{copy("draft.search.volume")}</dt>
        <dd className="min-w-0 wrap-anywhere">{volume.isDash ? (volume.line ?? volume.text) : volume.text}</dd>
        {rival === null ? null : (
          <>
            <dt className="text-base-content/70">{copy("draft.search.rival")}</dt>
            <dd className="num min-w-0 wrap-anywhere">{rival}</dd>
          </>
        )}
      </dl>
    </details>
  );
}

/** The card, in each of the three states a draft's target can be in. With
 *  `children` it is a live page's: the icon heads the title, and the
 *  controls follow the reason under a rule (board `PageDetail`). */
export function WhyThisPage(p: { target: DraftTarget; children?: React.ReactNode }): React.JSX.Element {
  const { target } = p;
  const stacked = p.children !== undefined;
  const tile = (
    <span className="bg-primary/10 text-primary rounded-box grid size-9 shrink-0 place-items-center" aria-hidden>
      <Search size={18} strokeWidth={1.75} />
    </span>
  );
  const title = (
    <h2 id="draft-why-title" className="text-base font-semibold">
      {copy("draft.why.title")}
    </h2>
  );
  return (
    <section className={NOTE.card} aria-labelledby="draft-why-title" data-testid="draft-why">
      <div className={`card-body min-w-0 gap-3 p-5 ${stacked ? "" : "flex-row items-start"}`}>
        {stacked ? (
          <span className="flex min-w-0 items-center gap-2.5">
            {tile}
            {title}
          </span>
        ) : (
          tile
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {stacked ? null : title}
          {target.kind === "target" ? (
            <>
              {reasonLines(target).map((line) => (
                <p key={line} className="min-w-0 wrap-anywhere">
                  {line}
                </p>
              ))}
              <SearchRows target={target} />
            </>
          ) : (
            <p className="text-sm text-base-content/70">
              {copy(target.kind === "fix" ? "draft.target.fix" : "draft.target.unknown")}
            </p>
          )}
        </div>
        {stacked ? <div className="border-base-300 border-t pt-4">{p.children}</div> : null}
      </div>
    </section>
  );
}
