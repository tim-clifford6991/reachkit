// BUILD §4.1 module 4 — the DIY collapses
//
// The complete method, free, on the same page: three collapsed sections,
// one per problem, in the cards' own order. Instructional text is allowed
// here and nowhere else on this screen (`BUILD.md` §4.1), and it is still
// the owner's — every sentence is a `CopyKey`.
//
// Collapsed markup, never a lazy fetch: the whole method is in the first
// response, so it is readable with JavaScript off, and nothing is asked
// for to read it — no payment, no address, no account, no session read
// and no branch on identity anywhere in this file.
//
// The union is the same three `ProblemName`s the cards render, so a method
// section cannot go missing for a problem that has a card.
import type React from "react";
import { Collapse } from "@/ui/components";
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
      {/* The module's own label (UI-SPEC S2: "The complete method, free"),
          at the eyebrow rung — a label over a list, not a fourth card. */}
      <p className="eyebrow text-[color:var(--ink-quiet)]">{copy("method.title")}</p>
      {p.for.map((problem) => (
        <Collapse key={problem} summary={copy(METHOD_COPY[problem].title)}>
          <p>{copy(METHOD_COPY[problem].body)}</p>
        </Collapse>
      ))}
    </div>
  );
}

/** The order the sections render in is the cards' own, re-exported here so
 *  a caller cannot pass a different one by accident. */
export const METHOD_ORDER = PROBLEM_ORDER;
