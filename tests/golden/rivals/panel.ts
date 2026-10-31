// tests/golden/rivals/panel.ts — each customer-panel site's stored searches,
// as the report a pass over them would store. Not a suite.
//
// Every search the site's passes bought is one question, read off its newest
// stored SERP (`../plan/panel.ts`), at the volume and difficulty the newest
// stored keyword read gave it (none read: 0). A site the panel lists a place
// for is measured in that town. The site has no ranked pages and no sized
// rivals, as on a free pass. 0¢: nothing is measured.
import { buildAiAnswersCard } from "@/lib/market/questions/matrix";
import type { Question } from "@/lib/market/questions/phrase";
import { deriveRivals, type RivalCandidate } from "@/lib/market/rivals/derive";
import { measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { answersSectionOf } from "@/lib/scan/sections";
import { assembleReport } from "@/lib/scan/store";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { AT, fullSections } from "../../scan/report/fixtures";
import { businessOf, storedEvidence, storedPayloads } from "../plan/panel";

type KeywordRead = { keyword: string; searchVolume?: number | null; difficulty?: number | null };

/** The newest volume and difficulty each stored keyword read gave a search. */
function keywordReads(domain: string): Map<string, KeywordRead> {
  const reads = new Map<string, KeywordRead>();
  for (const row of storedEvidence(domain).filter((entry) => entry.source.startsWith("dataforseo_labs/google/keyword_"))) {
    for (const read of (row.payload ?? []) as KeywordRead[]) reads.set(read.keyword, { ...reads.get(read.keyword), ...read });
  }
  return reads;
}

export interface PanelReport {
  report: StoredReport;
  rivals: RivalCandidate[];
}

export function panelReport(domain: string): PanelReport {
  const stored = [...storedPayloads(domain).values()];
  const reads = keywordReads(domain);
  const questions: Question[] = stored.map(({ search }, n) => {
    const read = reads.get(search);
    const difficulty = read?.difficulty ?? undefined;
    const selected = { keyword: search, volume: read?.searchVolume ?? 0, intent: "decision" as const, score: 0, rank: n + 1 };
    return { id: `q${n + 1}`, text: search, search: difficulty === undefined ? selected : { ...selected, difficulty }, phrasing: "template" };
  });
  const serps = stored.map(({ at, serp }) => measured(serp, at));
  const local = businessOf(domain).serves !== null;
  const { rivals, sources } = deriveRivals({ serps: stored.map(({ serp }) => serp), ownDomain: domain, local });
  const asked = measured(questions, AT);
  const card = buildAiAnswersCard({ questions, serps, ownDomain: domain, coverage: "async_included" });
  const report = assembleReport(
    fullSections({
      domain: domain as CanonicalDomain,
      questions: asked,
      serps,
      rivals: measured(rivals, AT),
      sources,
      aiAnswers: answersSectionOf({ card, questions: asked, rivals, ownDomain: domain, measuredAt: AT }),
    })
  );
  return { report, rivals };
}
