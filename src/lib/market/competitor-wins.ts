// SPEC §6 *A competitor wins, the site is absent*: a question a competitor in force is mentioned, linked, cited or ranked
// on and the site is not becomes an `ai_gap` topic, titled as the buyer asks it. Pure, 0¢: the answers are a healthy
// pass's stored reading, the wordings the site's own stored SERPs, the ranked rows the rivals' sizing cached.
import { PLAN_DEPTH } from "@/lib/config/constants";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import { ownPlaceIn, registrableDomain } from "@/lib/market/rivals/domains";
import type { Measured } from "@/lib/measure/measured";
import type { PromptAnswer, PromptsSection, StoredReport } from "@/lib/scan/report";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import { queryKey } from "@/lib/opportunities/cluster";
import { closestPrompt } from "@/lib/opportunities/intent";
import { askedOnMarket, rivalBrandOnly, type AskedTopic, type ProposedTopic } from "@/lib/opportunities/derive/topics";
import { demandBand, difficultyBand } from "@/lib/opportunities/winnability/band";
import { qualifyingDemand } from "@/lib/opportunities/winnability/bars";

/** A competitor's place on a search counts down to here; the site's absence is read against the same. */
const RANKED_PLACE_MAX = 20;

const domainOf = (url: string): string | null => registrableDomain(URL.canParse(url) ? new URL(url).hostname : url);

/** The rival an answer mentioned or linked while it neither named nor linked the site; `null` where it did not. */
function rivalOverSite(answer: PromptAnswer, competitors: ReadonlySet<string>): string | null {
  if (answer.named || answer.linked || answer.ownUrls.length > 0) return null;
  const linked = (answer.cited ?? []).map(domainOf).find((domain) => domain !== null && competitors.has(domain));
  return answer.rivals[0] ?? linked ?? null;
}

/** A page's subject, from the last segment of its address: two to six words, none a number. */
function subjectOf(page: string): string | null {
  try {
    const last = new URL(page).pathname.split("/").filter(Boolean).at(-1) ?? "";
    const words = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, "").toLowerCase().split(/[-_+\s]+/u).filter((word) => word !== "");
    return words.length >= 2 && words.length <= 6 && !words.some((word) => /\d/u.test(word)) ? words.join(" ") : null;
  } catch {
    return null;
  }
}

/** Whether a stored reading shows the site off a search's first 20; `null` where nothing read it. */
function siteAbsent(key: string, a: { report: StoredReport; ownRanked: Measured<number> }): string | null {
  const own = registrableDomain(a.report.domain) ?? a.report.domain;
  const index = a.report.questions.kind === "unmeasured" ? -1 : a.report.questions.value.findIndex((question) => queryKey(question.search.keyword) === key);
  const serp = a.report.serps[index];
  if (serp !== undefined && serp.kind === "measured") return ownPlaceIn(serp.value.organic, own) === false ? `the stored results page for "${key}" holds no page of the site` : null;
  const rows = a.report.ownRankedRows ?? [];
  const placed = rows.find((row) => queryKey(row.keyword) === key);
  if (placed !== undefined && placed.position <= RANKED_PLACE_MAX) return null;
  // Rows short of the site's whole count say nothing about a search they leave out.
  const complete = a.ownRanked.kind !== "unmeasured" && a.ownRanked.value <= rows.length;
  return complete ? `the site's ${rows.length} stored ranked rows ${placed === undefined ? "omit it" : `place it at ${placed.position}`}` : null;
}

/**
 * One source over four signals, each row recording its own: an unbranded prompt's answer that gave a competitor and
 * not the site (`prompt`), a competitor's page that answer cited (`cited`), and a search a competitor's stored ranked
 * rows hold at 1–20 where a stored reading shows the site absent (`ranked`). The AI answer cells of the report's own
 * searches are the fourth, read where those searches are derived (`derive/write.ts`). A prompt or a page is worded
 * by the "People also ask" question or related search `closestPrompt` matches to it, else by its own words, unmeasured; a
 * ranked search is the buyer's own words, right-sized ones first and an outsized one ranked lower, never dropped.
 */
export function competitorWins(a: {
  section: PromptsSection | null;
  /** Search and business competitors, as registrable domains. */
  competitors: readonly string[];
  /** Each competitor's ranked rows, as its sizing last cached them; a competitor with none here says nothing. */
  ranked: ReadonlyMap<string, readonly RankedRow[]>;
  report: StoredReport;
  ownRanked: Measured<number>;
  asked: readonly AskedTopic[];
  taken: readonly string[];
  market: MarketConclusion | null;
  own: readonly string[];
  rivals: readonly string[];
  max: number;
}): { gaps: ProposedTopic[]; unworded: number } {
  const competitors = new Set(a.competitors.flatMap((domain) => registrableDomain(domain) ?? []));
  const seen = new Set(a.taken.map(queryKey));
  const gaps: ProposedTopic[] = [];
  const add = (query: string, topic: Omit<ProposedTopic, "query" | "source">): void => {
    const key = queryKey(query);
    if (key === "" || gaps.length >= a.max || seen.has(key) || malformedSearch(key, a.market?.rivals) !== null) return;
    if (!askedOnMarket(key, a) || rivalBrandOnly(key, a)) return;
    seen.add(key);
    gaps.push({ query: key, source: "ai_gap", ...topic });
  };
  const worded = (text: string): AskedTopic | null => {
    const wordings = a.asked.filter((topic) => queryKey(topic.query) !== queryKey(text)).map((topic) => ({ id: topic.query, text: topic.query, topic }));
    return closestPrompt(text, wordings)?.topic ?? null;
  };

  for (const prompt of a.section?.asked ?? []) {
    if (prompt.kind === "branded") continue;
    const won = (a.section?.answers ?? []).flatMap((answer) => {
      const rival = answer.promptId === prompt.id ? rivalOverSite(answer, competitors) : null;
      return rival === null ? [] : [{ answer, rival, absent: `the ${answer.engine} answer to "${prompt.text}" names and links no page of the site` }];
    });
    if (won[0] === undefined) continue;
    const wording = worded(prompt.text);
    const asked = wording === null ? {} : { asked: { term: wording.term, serpAt: wording.serpAt } };
    add(wording?.query ?? prompt.text, { volume: null, rival: won[0].rival, ...asked, prompt: { id: prompt.id, text: prompt.text }, win: { signal: "prompt", competitor: won[0].rival, absent: won[0].absent } });
    for (const { answer, absent } of won) {
      for (const url of answer.cited ?? []) {
        const domain = domainOf(url);
        const subject = subjectOf(url);
        const page = domain !== null && competitors.has(domain) && subject !== null ? worded(subject) : null;
        if (page !== null && domain !== null) add(page.query, { volume: null, rival: domain, cited: url, asked: { term: page.term, serpAt: page.serpAt }, win: { signal: "cited", competitor: domain, absent } });
      }
    }
  }

  const ownRanked = a.ownRanked.kind === "unmeasured" ? 0 : a.ownRanked.value;
  const wins = [...a.ranked].filter(([domain]) => competitors.has(registrableDomain(domain) ?? domain)).flatMap(([domain, rows]) =>
    rows.flatMap((row) => {
      const band = difficultyBand({ difficulty: row.difficulty, ownRanked }) ?? demandBand({ volume: row.searchVolume, ownRanked });
      const sized = row.searchVolume <= qualifyingDemand(ownRanked) && band !== "not-yet";
      const absent = row.position <= RANKED_PLACE_MAX ? siteAbsent(queryKey(row.keyword), a) : null;
      return absent === null ? [] : [{ row, domain, absent, sized }];
    })
  );
  // Right-sized first, then largest, and a week's worth: the one fit call is shared with every other source.
  const room = Math.min(a.max, gaps.length + PLAN_DEPTH);
  const order = (x: (typeof wins)[number], y: (typeof wins)[number]) => Number(y.sized) - Number(x.sized) || y.row.searchVolume - x.row.searchVolume || x.row.position - y.row.position;
  for (const { row, domain, absent } of wins.sort(order)) {
    if (gaps.length >= room) break;
    add(row.keyword, { volume: row.searchVolume, difficulty: row.difficulty, rival: domain, win: { signal: "ranked", competitor: domain, absent: `${domain} ranks ${row.position}; ${absent}` } });
  }
  // Every prompt is proposed, worded or not; the count stays for the ledger's shape.
  return { gaps, unworded: 0 };
}
