// BUILD §4.1 module 4 — the DIY collapses
//
// The complete method, free, on the same page: three collapsed sections,
// one per problem, in the cards' own order. Every sentence is a `CopyKey`.
//
// daisyUI `collapse` on `details`/`summary`, never a lazy fetch: the whole
// method is in the first response, readable with JavaScript off, and
// nothing is asked for to read it — no payment, no address, no account.
//
// The union is the same three `ProblemName`s the cards render, so a method
// section cannot go missing for a problem that has a card.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PROBLEM_ORDER, type ProblemName } from "./model";

const METHOD_COPY: Readonly<Record<ProblemName, { title: CopyKey; body: CopyKey }>> = Object.freeze({
  blocked_readers: { title: "method.blocked-readers.title", body: "method.blocked-readers.body" },
  missing_pages: { title: "method.missing-pages.title", body: "method.missing-pages.body" },
  unquotable_pages: { title: "method.unquotable-pages.title", body: "method.unquotable-pages.body" },
});

export function MethodSections(p: {
  for: readonly [ProblemName, ProblemName, ProblemName];
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
        {copy("method.title")}
      </p>
      {p.for.map((problem) => (
        <details key={problem} className="collapse collapse-arrow bg-base-100 border-base-300 border">
          <summary className="collapse-title font-medium">{copy(METHOD_COPY[problem].title)}</summary>
          <div className="collapse-content text-sm">
            <p>{copy(METHOD_COPY[problem].body)}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

/** The order the sections render in is the cards' own, re-exported here so
 *  a caller cannot pass a different one by accident. */
export const METHOD_ORDER = PROBLEM_ORDER;
