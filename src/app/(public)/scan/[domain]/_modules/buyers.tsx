// SPEC §2, board PubReport — who gets the buyers (owner R12, 2026-10-31)
//
// The report leads with it: a headline naming the competitor the buyers
// were sent to most, with the customer's own count over both cards, drawn
// only where both cards measured something, so a count is never summed over
// a missing half. The section below holds the two cards under its heading.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { AiAnswersSection, PresenceSection } from "@/lib/scan/report";

/** The rival named by most AI answers and first pages together, only where
 *  it was named more often than the customer, and the customer's own count
 *  over the same two denominators. */
export function buyersOf(ai: AiAnswersSection, presence: PresenceSection): {
  holder: string | null;
  ai: number;
  google: number;
  out: number;
} {
  const tally = new Map<string, number>();
  for (const rival of ai.rivals) {
    const cited = rival.cells.filter((c) => c.kind === "answered" && c.citedDomains.length > 0).length;
    tally.set(rival.domain, (tally.get(rival.domain) ?? 0) + cited);
  }
  for (const rival of presence.rivals) tally.set(rival.domain, (tally.get(rival.domain) ?? 0) + rival.top10Count);
  let holder: string | null = null;
  let most = 0;
  for (const [domain, count] of tally) {
    if (count > most) {
      holder = domain;
      most = count;
    }
  }
  const you = ai.customerCitations + presence.you.top10Count;
  return {
    holder: most > you ? holder : null,
    ai: ai.customerCitations,
    google: presence.you.top10Count,
    out: ai.answeredSearches + presence.measuredSearches,
  };
}

/** The headline's title and line, or `null` where a card was not measured:
 *  nothing measured is never shown as a count of zero. */
export function headlineOf(ai: AiAnswersSection | null, presence: PresenceSection | null): { title: string; line: string } | null {
  if (ai === null || presence === null) return null;
  const b = buyersOf(ai, presence);
  if (b.out === 0) return null;
  const n = b.ai + b.google;
  const m = String(b.out);
  // A site found at least as often as every competitor leads; "can't find you" is only true at zero.
  const title = b.holder === null ? copy(n > 0 ? "report.top.title.you-lead" : "report.top.title.none") : copy("report.top.title", { holder: b.holder });
  return { title, line: n === 1 ? copy("report.top.line.one", { m }) : copy("report.top.line", { n: String(n), m }) };
}

/** The offer line: the count is the missing-pages list's own, and "free" only where a first page exists. */
function offerLine(count: number, free: boolean): string | null {
  if (count === 0) return null;
  if (count === 1) return copy(free ? "report.top.offer.one" : "report.top.offer.no-free.one");
  return copy(free ? "report.top.offer" : "report.top.offer.no-free", { count: String(count) });
}

/** The report's headline: who gets the buyers, then the pages it found, which lead to the offer. */
export function HeadlineBlock(p: { ai: AiAnswersSection | null; presence: PresenceSection | null; missing: number; free: boolean }): React.JSX.Element | null {
  const top = headlineOf(p.ai, p.presence);
  const offer = offerLine(p.missing, p.free);
  if (top === null && offer === null) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="report-top">
      {top === null ? null : (
        <>
          <h2 className="text-2xl font-bold">{top.title}</h2>
          <p>{top.line}</p>
        </>
      )}
      {offer === null ? null : (
        <a href="#start" className="link link-primary font-semibold" data-testid="report-top-offer">
          {offer}
        </a>
      )}
    </div>
  );
}

export function BuyersSection(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section id="buyers" aria-labelledby="buyers-h" className="col-span-full grid scroll-mt-20 grid-cols-subgrid gap-y-5">
      <h2 id="buyers-h" className="col-span-full text-2xl font-bold">
        {copy("report.buyers.title")}
      </h2>
      {p.children}
    </section>
  );
}
