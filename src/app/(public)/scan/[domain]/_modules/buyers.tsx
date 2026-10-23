// SPEC §2, board PubReport — who gets the buyers today
//
// The section over the AI and Google cards: its heading and lead, and one
// sentence naming the competitor the buyers were sent to most, with the
// customer's own count over both cards. The sentence is drawn only where
// both cards were measured, so a count is never summed over a missing half.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { AiAnswersSection, PresenceSection } from "@/lib/scan/report";

/** The rival named by most AI answers and first pages together, and the
 *  customer's own count over the same two denominators. */
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
  return {
    holder,
    ai: ai.customerCitations,
    google: presence.you.top10Count,
    out: ai.answeredSearches + presence.measuredSearches,
  };
}

function summaryLine(b: ReturnType<typeof buyersOf>): string {
  const n = b.ai + b.google;
  const counts = { n: String(n), m: String(b.out) };
  if (b.holder === null) return copy(n === 1 ? "report.buyers.summary.none.one" : "report.buyers.summary.none", counts);
  return copy(n === 1 ? "report.buyers.summary.one" : "report.buyers.summary", { ...counts, holder: b.holder });
}

function splitLine(b: ReturnType<typeof buyersOf>): string {
  return copy("report.buyers.split", {
    ai: copy(b.ai === 1 ? "report.buyers.split.ai.one" : "report.buyers.split.ai", { n: String(b.ai) }),
    google: copy(b.google === 1 ? "report.buyers.split.google.one" : "report.buyers.split.google", { n: String(b.google) }),
  });
}

export function BuyersSection(p: {
  ai: AiAnswersSection | null;
  presence: PresenceSection | null;
  children: React.ReactNode;
}): React.JSX.Element {
  const buyers = p.ai === null || p.presence === null ? null : buyersOf(p.ai, p.presence);
  return (
    <section id="buyers" aria-labelledby="buyers-h" className="col-span-full grid scroll-mt-20 grid-cols-subgrid gap-y-5">
      <div className="col-span-full flex max-w-3xl flex-col gap-2">
        <p className="eyebrow">{copy("report.jump.buyers")}</p>
        <h2 id="buyers-h" className="text-2xl font-bold">
          {copy("report.buyers.title")}
        </h2>
        <p className="text-base-content/70">{copy("report.buyers.lead")}</p>
        {buyers === null ? null : (
          <p className="flex flex-wrap items-baseline gap-x-2" data-testid="report-buyers-summary">
            <span className="font-semibold">{summaryLine(buyers)}</span>
            <span className="text-base-content/70 text-sm">{splitLine(buyers)}</span>
          </p>
        )}
      </div>
      {p.children}
    </section>
  );
}
