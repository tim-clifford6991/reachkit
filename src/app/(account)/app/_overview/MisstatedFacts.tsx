// Issue 1539 — Overview's finding about what AI answers misstate: each fact
// an answer gave the business that its own site contradicts, both said in
// plain words, with the answer's own words beside it and the page where the
// site says it. Said only while there is one; the next page on the topic
// states the site's fact, so nothing here asks the customer to act.
import type React from "react";
import type { MisstatedFact } from "@/lib/market/prompts/misstated-types";
import { copy } from "@/lib/presentation/copy";

/** The most findings said at once: the rest are the same kind of news. */
const SHOWN = 3;

export function MisstatedFacts({ findings }: { findings: readonly MisstatedFact[] }): React.JSX.Element {
  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0" data-testid="overview-misstated">
      <div className="card-body gap-3">
        <h2 className="card-title">{copy("overview.misstated.title")}</h2>
        <ul className="flex min-w-0 flex-col gap-3">
          {findings.slice(0, SHOWN).map((finding) => (
            <li key={`${finding.kind}|${finding.aiSays}|${finding.siteSays}`} className="min-w-0">
              <p className="min-w-0 text-sm break-words">{copy("overview.misstated.row", { ai: finding.aiSays, site: finding.siteSays.replace(/[.!?]+$/, "") })}</p>
              <p className="text-base-content/70 min-w-0 text-sm break-words">
                <q>{finding.answer}</q>
              </p>
              {finding.url === null ? null : (
                <a className="link link-primary text-sm break-all" href={finding.url}>
                  {copy("overview.misstated.source")}
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="text-base-content/70 text-sm">{copy("overview.misstated.next")}</p>
      </div>
    </section>
  );
}
