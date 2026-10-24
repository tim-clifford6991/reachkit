// SPEC §7 — why this page was written, and the search it is for (board
// `AppDraft`): the week's reason in words, then one closed line naming the
// search, how often it is searched and who answers it today. Every value was
// stored on the opportunity when the page was chosen; nothing is re-measured.
import type React from "react";
import { Search } from "lucide-react";
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
    <details className="collapse collapse-arrow bg-base-200 min-w-0" data-testid="draft-search">
      <summary className="collapse-title min-h-0 text-sm font-medium">{copy("draft.search.title")}</summary>
      <dl className="collapse-content grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
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

/** The card, in each of the three states a draft's target can be in. */
export function WhyThisPage(p: { target: DraftTarget }): React.JSX.Element {
  const { target } = p;
  return (
    <section className={NOTE.card} aria-labelledby="draft-why-title" data-testid="draft-why">
      <div className="card-body min-w-0 flex-row items-start gap-3 p-5">
        <span className="bg-primary/10 text-primary rounded-box grid size-9 shrink-0 place-items-center" aria-hidden>
          <Search size={18} strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 id="draft-why-title" className="text-base font-semibold">
            {copy("draft.why.title")}
          </h2>
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
      </div>
    </section>
  );
}
