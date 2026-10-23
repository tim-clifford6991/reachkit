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
//
// Each card's *show me* link lands in its section's content (#1068), which
// opens the collapse around it; the robots lines a founder pastes live
// here, under the method that says where to paste them.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { METHOD_ANCHOR, PasteBlock } from "./cards";
import type { ProblemName } from "./model";

const METHOD_COPY: Readonly<Record<ProblemName, { title: CopyKey; body: CopyKey }>> = Object.freeze({
  blocked_readers: { title: "method.blocked-readers.title", body: "method.blocked-readers.body" },
  missing_pages: { title: "method.missing-pages.title", body: "method.missing-pages.body" },
  unquotable_pages: { title: "method.unquotable-pages.title", body: "method.unquotable-pages.body" },
});

export function MethodSections(p: {
  for: readonly [ProblemName, ProblemName, ProblemName];
  /** The lines the blocked-readers card's fix carries, where it has any. */
  lines?: Partial<Readonly<Record<ProblemName, readonly string[]>>>;
  /** SPEC §9 (D14): the pages a snippet control keeps out of an answer, and
   *  the training crawlers the site turns away — a choice, said as one. */
  readers?: { snippetPages: readonly string[]; trainingOptOut: readonly string[] };
}): React.JSX.Element {
  const snippetPages = p.readers?.snippetPages ?? [];
  const trainingOptOut = p.readers?.trainingOptOut ?? [];
  return (
    // Closed under its own name like What holds you back (board PubReport); a link into a step opens both.
    <details id="method" className="collapse collapse-arrow scroll-mt-20 rounded-none" data-testid="report-method">
      <summary className="collapse-title min-h-0 px-px py-2 pe-10 after:end-2 after:top-6">
        <h2 className="text-2xl font-bold">{copy("method.title")}</h2>
        <p className="text-base-content/70 text-sm font-normal">{copy("method.section.sub")}</p>
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-2 px-px">
        {p.for.map((problem) => {
          const lines = p.lines?.[problem];
          return (
            <details key={problem} className="collapse collapse-arrow bg-base-100 shadow-(--shadow-card)">
              <summary className="collapse-title font-medium">{copy(METHOD_COPY[problem].title)}</summary>
              <div id={METHOD_ANCHOR[problem]} className="collapse-content flex scroll-mt-20 flex-col gap-3 text-sm">
                <p>{copy(METHOD_COPY[problem].body)}</p>
                {lines === undefined || lines.length === 0 ? null : <PasteBlock lines={lines} />}
                {problem !== "blocked_readers" || snippetPages.length === 0 ? null : (
                  <div className="flex flex-col gap-1">
                    <p>{copy("method.blocked-readers.snippet-pages")}</p>
                    <ul className="list-inside list-disc">
                      {snippetPages.map((url) => (
                        <li key={url} className="min-w-0 break-all">
                          {url}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {problem !== "blocked_readers" || trainingOptOut.length === 0 ? null : (
                  <p className="text-base-content/70">
                    {copy("method.blocked-readers.training-choice", { crawlers: trainingOptOut.join(", ") })}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}
