// SPEC §6 (2026-09-20, #908; its two numbers confirmed as written by the
// owner on 2026-09-21, §12 · #985) — which questions a weekly pass tracks,
// and how the set stays the size it promised to be.
//
// "Each published page's own question may join the tracked set: **at most
// 24 tracked questions in all** (the twelve plus twelve) … and a page's
// question leaves the set after **8 weeks** without a mention. The set never
// grows past the cap, so its cost is flat." The page slots go to the pages
// due a reading first, newest first, then to pages climbing at 11–30, then
// to pages AI linked (owner B2 and D2, 2026-10-19).
//
// **The cap is the feature.** The owner's worry was a set that grows with
// every page published — a site with thirty live pages costing fifteen
// times a site with two, every Monday, for ever. So the arithmetic is
// here, in one pure function with no clock, no store and no vendor: the
// twelve the market selected are counted first and are never displaced,
// and the page half is whatever is left of twenty-four.
//
// **A miss is a week we asked and nobody named the site.** A week the
// question was not asked at all — a pass that stopped at its ceiling, a
// page published three weeks ago — is not a miss: it is a week with no
// answer, and counting it would retire a question for the pass's own
// failure rather than for the market's silence.
//
// **Retirement is not deletion.** A retired question keeps every answer it
// ever had, in the reports that recorded them; what it loses is its slot.
// Nothing here writes anything, and no caller may read "retired" as "drop
// the history".
import { BATTERY, PAGE_QUESTION_READ, PAGE_QUESTION_RETIRE_WEEKS, TRACKED_QUESTIONS_MAX, VENDOR } from "@/lib/config/constants";
import type { SerpDepth } from "@/lib/vendors/dataforseo/transport";

/** One published page that could carry a tracked question. */
export interface PageQuestionCandidate {
  /** The publication this question belongs to — its identity in the set,
   *  across weeks and across rewordings of the page's own title. */
  publicationId: string;
  /** Where the page is, for the row the screen draws. */
  liveUrl: string;
  /** The question as it is asked: the opportunity's own asked-as form,
   *  written when the target was chosen and never composed here. */
  question: string;
  /** The search the page targets, carried so a row can say what the page
   *  is for without a second read. */
  search: string;
  /** Where the page was last seen for that search: its stored reading's
   *  place, else the site's ranked rows. `null` where it was seen nowhere. */
  position: number | null;
  /** When the page went live; `null` where the row does not say. */
  publishedAt: string | null;
  /** An AI answer to the page's own question linked it at its last reading. */
  linked: boolean;
}

/** How many consecutive weekly passes have asked this page's question and
 *  heard nothing — counted back from the newest pass that asked it. */
export type MissesByPage = ReadonlyMap<string, number>;

export interface TrackedQuestions {
  /** The page questions this pass asks, in slot order. */
  asked: readonly PageQuestionCandidate[];
  /** The candidates whose question has run out of weeks. They keep their
   *  history; what they lose is the slot. */
  retired: readonly PageQuestionCandidate[];
  /** Candidates that neither retired nor fitted — the set was already
   *  full. They are not retired and they are asked again the week a slot
   *  opens. */
  waiting: readonly PageQuestionCandidate[];
  /** What the pass tracks in all this week: the market's questions plus
   *  the page questions asked. Never above the cap, by construction. */
  tracked: number;
}

const WEEK_MS = 7 * 86_400_000;

/** Whole weeks since the page went live, or `null` where that is unknown. */
function weeksLive(candidate: PageQuestionCandidate, now: Date): number | null {
  const at = candidate.publishedAt === null ? Number.NaN : Date.parse(candidate.publishedAt);
  return Number.isNaN(at) ? null : Math.floor(Math.max(0, now.getTime() - at) / WEEK_MS);
}

/** The slot tier: due this week, then climbing, then linked, then the rest. */
function tierOf(candidate: PageQuestionCandidate, now: Date): number {
  const weeks = weeksLive(candidate, now);
  if (weeks !== null && (PAGE_QUESTION_READ.DUE_WEEKS as readonly number[]).includes(weeks)) return 0;
  const { from, to } = PAGE_QUESTION_READ.CLIMBING;
  if (candidate.position !== null && candidate.position >= from && candidate.position <= to) return 1;
  return candidate.linked ? 2 : 3;
}

/** Due pages newest first; every other tier nearest the first page first.
 *  Ties break on the publication id so two passes over the same data ask
 *  the same questions in the same order. */
function slotOrder(now: Date): (a: PageQuestionCandidate, b: PageQuestionCandidate) => number {
  return (a, b) => {
    const tier = tierOf(a, now) - tierOf(b, now);
    if (tier !== 0) return tier;
    if (tierOf(a, now) === 0) {
      const newer = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      if (newer !== 0) return newer;
    }
    const left = a.position ?? Number.MAX_SAFE_INTEGER;
    const right = b.position ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.publicationId.localeCompare(b.publicationId);
  };
}

/** The asked slots read deep; past them a thin market's extra slots read one
 *  page of ten, so the weekly spend stays flat whatever the market selects. */
const DEEP_SLOTS = TRACKED_QUESTIONS_MAX - BATTERY.QUESTIONS;

/** How deep a page's own result is read: all the way until it is seen, then
 *  a page of ten past where it was last seen, never shallower than the
 *  verdict's own line. `slot` is its place among the asked, from 0. */
export function slotDepth(candidate: Pick<PageQuestionCandidate, "position">, slot: number): SerpDepth {
  if (slot >= DEEP_SLOTS) return VENDOR.serpDepth;
  const { DEPTH_MAX, DEPTH_MIN, DEPTH_PAST } = PAGE_QUESTION_READ;
  if (candidate.position === null) return DEPTH_MAX;
  const depth = Math.ceil((candidate.position + DEPTH_PAST) / 10) * 10;
  return Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, depth)) as SerpDepth;
}

/**
 * The page questions this pass asks, and the ones whose slot has come to
 * an end.
 *
 * `selected` is how many questions the market selected this week — the
 * twelve, or fewer where the market yielded fewer. The page half is
 * whatever is left of the cap, so a thin market does not shrink the
 * tracking and a rich one does not overflow it.
 *
 * Pure, total, and bounded by two pins that are read here and nowhere
 * else in this directory.
 */
export function trackedQuestions(a: {
  selected: number;
  candidates: readonly PageQuestionCandidate[];
  misses: MissesByPage;
  /** The pass's own clock, which decides the pages due this week. */
  now: Date;
  /** Both pins are parameters with the pin as the default, so the
   *  arithmetic can be driven at its edges by a test without either
   *  number becoming a setting: no caller in `src/` passes them. */
  max?: number;
  retireAfter?: number;
}): TrackedQuestions {
  const max = Math.max(0, a.max ?? TRACKED_QUESTIONS_MAX);
  const retireAfter = Math.max(1, a.retireAfter ?? PAGE_QUESTION_RETIRE_WEEKS);
  const selected = Math.max(0, a.selected);

  const retired: PageQuestionCandidate[] = [];
  const live: PageQuestionCandidate[] = [];
  for (const candidate of [...a.candidates].sort(slotOrder(a.now))) {
    const missed = a.misses.get(candidate.publicationId) ?? 0;
    if (missed >= retireAfter) retired.push(candidate);
    else live.push(candidate);
  }

  // What is left of the cap once the market's own questions are counted.
  // Never negative: a market that somehow selected more than the cap
  // leaves no room for a page question, and takes no page's slot away
  // from it either — the twelve are not this function's to trim.
  const room = Math.max(0, max - selected);
  const asked = live.slice(0, room);
  return {
    asked,
    retired,
    waiting: live.slice(room),
    tracked: selected + asked.length,
  };
}

/**
 * How many consecutive weeks each page's question has been asked without a
 * mention, newest week first.
 *
 * `weeks` is the stored history — one entry per weekly pass that asked
 * page questions, newest first, each naming which pages it asked and which
 * of them were mentioned. A week that did not ask a page's question is
 * skipped for that page rather than counted: the run is over the weeks
 * that *answered*, which is what "eight weeks without a mention" means.
 *
 * Counting stops at the first week that mentioned the page, because a
 * mention resets the run — a page named in week 3 has not gone eight weeks
 * without one, whatever weeks 4 to 10 said.
 */
export function missesByPage(
  weeks: readonly { asked: readonly string[]; mentioned: readonly string[] }[]
): MissesByPage {
  const misses = new Map<string, number>();
  const done = new Set<string>();
  for (const week of weeks) {
    const mentioned = new Set(week.mentioned);
    for (const publicationId of week.asked) {
      if (done.has(publicationId)) continue;
      if (mentioned.has(publicationId)) {
        done.add(publicationId);
        continue;
      }
      misses.set(publicationId, (misses.get(publicationId) ?? 0) + 1);
    }
  }
  return misses;
}
