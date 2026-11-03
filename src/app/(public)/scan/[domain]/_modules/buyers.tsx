// SPEC §2, board PubReport — who gets the buyers (owner R12, 2026-10-31)
//
// The report leads with it: the score as a sentence, the competitor the
// buyers were sent to most with the customer's own count over both cards,
// drawn only where both cards measured something so a count is never summed
// over a missing half, and the questions found. The section below holds the
// two cards under its heading.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { categoryOf } from "@/lib/scan/sections";
import { Num, SLOT } from "../_address/measured";
import { FIRST_PAGE_ANCHOR } from "../_problems/cards";
import { registrableDomain, resolvedHost } from "@/lib/market/rivals/domains";
import type { AiAnswersSection, PresenceSection, StoredReport } from "@/lib/scan/report";
import type { MatrixRow } from "./ai-answers";

/** One search is one buyer's question: a rival found on a single one is not where buyers are sent. */
const HOLDER_MIN_SEARCHES = 2;

/** The rival found on the most searches, each search counted once whether in
 *  its first page, its local pack or its AI answer, only where that is at least
 *  `HOLDER_MIN_SEARCHES` and more than the customer's own count over the same two denominators. */
export function buyersOf(ai: AiAnswersSection, presence: PresenceSection, serps: StoredReport["serps"]): {
  holder: string | null;
  ai: number;
  google: number;
  out: number;
} {
  const found = new Map<string, Set<string>>();
  const add = (domain: string, i: number): void => {
    const search = ai.rows[i]?.question.search;
    if (search !== undefined) found.set(domain, (found.get(domain) ?? new Set()).add(search));
  };
  for (const rival of ai.rivals) rival.cells.forEach((c, i) => (c.kind === "answered" && c.citedDomains.length > 0 ? add(rival.domain, i) : undefined));
  serps.forEach((serp, i) => {
    if (serp.kind === "unmeasured") return;
    const shown = new Set([...serp.value.organic.map(resolvedHost), ...(serp.value.localPack ?? []).map((row) => row.domain)].map((host) => registrableDomain(host ?? "")));
    for (const rival of presence.rivals) if (shown.has(rival.domain)) add(rival.domain, i);
  });
  let holder: string | null = null;
  let most = HOLDER_MIN_SEARCHES - 1;
  for (const [domain, searches] of found) {
    if (searches.size > most) {
      holder = domain;
      most = searches.size;
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

/** A sentence with its one domain at `SLOT`. */
type Line = { sentence: string; value?: string };

/** The domain in mono, clamped with its whole name on `title`, so a long one never widens the line. */
function Said(p: { line: Line }): React.JSX.Element {
  if (p.line.value === undefined) return <>{p.line.sentence}</>;
  const [before = "", after = ""] = p.line.sentence.split(SLOT);
  return (
    <>
      {before}
      <Num clamp={p.line.value}>{p.line.value}</Num>
      {after}
    </>
  );
}

type HeadReport = Pick<StoredReport, "domain" | "verdict" | "market" | "aiAnswers" | "presence" | "serps">;

/** The score said as a sentence, or `null` where the report has no score. */
function titleOf(report: HeadReport): Line | null {
  const s = report.verdict.scoreAndBand;
  if (s.kind === "unmeasured") return null;
  const verdict = copy(SCORE_BANDS[s.value.band]).toLocaleLowerCase("en");
  return { sentence: copy("report.top.title", { domain: SLOT, score: String(s.value.score), verdict }), value: report.domain };
}

/** Who gets the buyers over both cards, with the one count that adds them,
 *  or `null` where a card or the category was not measured: nothing
 *  measured is never shown as a count of zero. */
function lineOf(report: HeadReport): Line | null {
  const category = categoryOf(report.market);
  if (report.aiAnswers === null || report.presence === null || category === null) return null;
  const b = buyersOf(report.aiAnswers, report.presence, report.serps);
  if (b.out === 0) return null;
  const n = b.ai + b.google;
  const split = copy("report.top.split", { g: String(b.google), gTotal: String(report.presence.measuredSearches), a: String(b.ai), aTotal: String(report.aiAnswers.answeredSearches) });
  const counts = { category, n: String(n), m: String(b.out), split };
  // A site found at least as often as every competitor leads; "can't find you" is only true at zero.
  if (b.holder === null) return { sentence: copy(n === 0 ? "report.top.line.none" : "report.top.line.you-lead", counts) };
  return { sentence: copy(n === 1 ? "report.top.line.one" : "report.top.line", { ...counts, rival: SLOT }), value: b.holder };
}

/** The report's top: its score, who gets the buyers, then the questions it found. */
export function headlineOf(report: HeadReport): { title: Line | null; line: Line | null } {
  return { title: titleOf(report), line: lineOf(report) };
}

/** The offer line: the count is the missing-pages list's own. */
function offerLine(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? copy("report.top.offer.one") : copy("report.top.offer", { count: String(count) });
}

/** The report's top three lines; the button to the free page only where there is one. */
export function HeadlineBlock(p: { report: HeadReport; missing: number; free: boolean }): React.JSX.Element | null {
  const { title, line } = headlineOf(p.report);
  const offer = offerLine(p.missing);
  if (title === null && line === null && offer === null) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="report-top">
      {title === null ? null : (
        <h2 className="text-2xl font-bold">
          <Said line={title} />
        </h2>
      )}
      {line === null ? null : (
        <p data-testid="report-top-line">
          <Said line={line} />
        </p>
      )}
      {offer === null ? null : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-semibold" data-testid="report-top-offer">
          <span>{offer}</span>
          {p.free ? (
            <a href={`#${FIRST_PAGE_ANCHOR}`} className="btn btn-soft btn-primary" data-testid="report-top-free">
              {copy("report.offer.free-path")}
            </a>
          ) : null}
        </p>
      )}
    </div>
  );
}

const AI_LEAD: { leader: CopyKey; you: CopyKey } = { leader: "report.ai.waffle", you: "report.ai.waffle.you-lead" };
const GOOGLE_LEAD: { leader: CopyKey; you: CopyKey } = { leader: "report.google.waffle", you: "report.google.waffle.you-lead" };

/** A card's waffle in one sentence, naming that card's own leader: the site named most where it beats the
 *  customer, else the customer where it is named at all, else nothing. */
export function WaffleLead(p: { rows: readonly MatrixRow[]; total: number; ai?: boolean }): React.JSX.Element | null {
  const keys = p.ai === true ? AI_LEAD : GOOGLE_LEAD;
  const mine = Number(p.rows.find((row) => row.you)?.count ?? 0);
  const top = p.rows.filter((row) => !row.you).reduce<MatrixRow | undefined>((best, row) => (best === undefined || Number(row.count) > Number(best.count) ? row : best), undefined);
  const slots = { you: String(mine), total: String(p.total) };
  if (top !== undefined && Number(top.count) > mine) {
    const [before = "", after = ""] = copy(keys.leader, { ...slots, leader: SLOT, x: top.count }).split(SLOT);
    // Clamped, with the whole name on `title`: a domain has no space to wrap at.
    return (
      <p className="grow-0 text-sm" data-testid="waffle-lead">
        {before}
        <Num clamp={top.name}>{top.name}</Num>
        {after}
      </p>
    );
  }
  return mine === 0 ? null : (
    <p className="grow-0 text-sm" data-testid="waffle-lead">
      {copy(keys.you, slots)}
    </p>
  );
}

export function BuyersSection(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    // A white band the screen's width, between the tinted head and the pages: the shadow paints the band, the clip keeps it to its own height.
    <section id="buyers" aria-labelledby="buyers-h" className="bg-base-100 col-span-full grid scroll-mt-20 grid-cols-subgrid gap-y-5 py-10 shadow-[0_0_0_100vmax_var(--color-base-100)] [clip-path:inset(0_-100vmax)]">
      <h2 id="buyers-h" className="col-span-full text-2xl font-bold">
        {copy("report.buyers.title")}
      </h2>
      {p.children}
    </section>
  );
}
