// SPEC §6 (2026-09-20, #908) — the AI answers tab's facts, as a fixture.
//
// **This is the reserved fixture account's AI answers tab, and nobody
// else's.** `answers-provider.ts` answers `isReservedFixtureAccount` from
// here and reads every other account's facts live, so what this file holds
// is one account's data rather than a placeholder for a missing read. It is
// what keeps the layout and visual sweeps deterministic.
//
// **It agrees with the fixtures beside it.** The market is the CRM one
// `search-fixture.ts` and `calendar/fixture.ts` already use, the Monday is
// the Monday the Overview's own series ends on, and the pages it links to
// are searches that fixture marks live. Two fixtures that disagreed about
// what this customer sells would be worse than no fixture at all.
//
// **The frame it shows is the dense one, on purpose**: all five marks, a
// question long enough to be clamped at 390, a week that measured only
// Google's column, four passes so the rate is over a full window, and
// questions with and without a page of their own — so the sweeps measure
// the screen at its widest rather than at its emptiest.
import { fromStored } from "@/lib/presentation/generated";
import type {
  AnswerMark,
  AnswerPage,
  AnswerQuestion,
  AnswersFacts,
  AnswerWeekFacts,
} from "./answers-model";

/** The pass these marks were taken by — the Monday `search-fixture.ts`
 *  measures on, and the last of the four weeks below. */
const MEASURED_AT = new Date(Date.UTC(2026, 7, 31, 6, 0, 0));

const MS_PER_WEEK = 7 * 86_400_000;

/** A Monday `n` weeks before the latest one, at the midday-UTC instant
 *  every surface states a `week_start` at. */
function monday(back: number): Date {
  return new Date(Date.UTC(2026, 7, 31, 12, 0, 0) - back * MS_PER_WEEK);
}

const L = "links_to_you" satisfies AnswerMark;
const N = "names_you" satisfies AnswerMark;
const O = "names_others" satisfies AnswerMark;
const X = "no_answer" satisfies AnswerMark;
const U = "not_measured" satisfies AnswerMark;

/** One question: its wording, the search it was phrased from, and the page
 *  ReachKit published for that search where there is one. */
type Spec = readonly [wording: string, search: string, page: AnswerPage | null];

/** A page of `content-fixture.ts`, by its title and its number there. */
const OWN = (title: string, n: number): AnswerPage => ({ title, url: `https://content.example.com/p/${n}` });

const PAGE = (title: string, slug: string): AnswerPage => ({
  title,
  url: `https://content.example.com/${slug}`,
});

const SPECS: readonly Spec[] = [
  [
    "What is the best CRM for a small team?",
    "best crm for small teams",
    PAGE("The best CRM for a small team, compared", "best-crm-small-teams"),
  ],
  [
    "How much does a CRM cost per user?",
    "how much does a crm cost per user",
    PAGE("What a CRM actually costs per user", "crm-cost-per-user"),
  ],
  ["Is a spreadsheet good enough instead of a CRM?", "crm vs spreadsheet", PAGE("CRM or spreadsheet?", "crm-vs-spreadsheet")],
  [
    "What should a two-person business look for when it is choosing its very first customer database?",
    "crm for a two person business",
    PAGE("Choosing a first CRM for two people", "crm-two-person-business"),
  ],
  ["Which CRM works with Gmail?", "crm that works with gmail", PAGE("CRMs that work inside Gmail", "crm-gmail")],
  ["What is a sales pipeline?", "what is a sales pipeline", null],
  ["How do I move my customers off a spreadsheet?", "how to move customers off a spreadsheet", null],
  ["Do I really need a CRM?", "do i really need a crm", PAGE("Do you really need a CRM?", "do-you-need-a-crm")],
  ["What is the best free CRM with unlimited contacts?", "free crm with unlimited contacts", null],
  ["Which CRM suits consultants?", "best crm for consultants", null],
  ["How do I import contacts into a CRM without duplicates?", "crm data import mistakes", null],
  ["What does CRM onboarding involve?", "crm onboarding checklist", null],
];

/**
 * The four passes' marks, oldest first, one row of three per question.
 *
 * Written out rather than generated: a fixture a rule produced is a fixture
 * that changes when the rule does, and the point of this one is that the
 * screen looks the same on every sweep. The oldest pass reached Google's
 * column alone — a real shape, and the one that proves an unmeasured cell
 * leaves the denominator rather than reading as a miss.
 */
const WEEKS: readonly (readonly (readonly AnswerMark[])[])[] = [
  // Four weeks ago: only the AI Overview column was reached.
  [[O, U, U], [O, U, U], [X, U, U], [O, U, U], [O, U, U], [O, U, U], [X, U, U], [O, U, U], [O, U, U], [O, U, U], [O, U, U], [X, U, U]],
  // Three weeks ago: the battery runs, and the first link lands.
  [[L, O, O], [O, O, O], [X, O, N], [O, O, O], [O, N, O], [O, O, X], [X, O, O], [O, O, O], [O, O, O], [O, X, O], [O, O, O], [X, O, O]],
  // Two weeks ago.
  [[L, O, N], [L, O, O], [X, N, N], [O, O, O], [N, N, O], [O, O, X], [O, O, O], [L, O, O], [O, O, O], [O, X, O], [O, O, O], [X, O, O]],
  // This week — the pass the grid draws.
  [[L, L, N], [L, O, N], [N, N, O], [O, O, O], [N, L, O], [O, O, X], [O, O, O], [L, O, N], [O, O, O], [O, X, O], [O, U, O], [X, O, O]],
];

function questionsFor(marks: readonly (readonly AnswerMark[])[]): readonly AnswerQuestion[] {
  return SPECS.map(([wording, search, page], i) => ({
    n: i + 1,
    wording: fromStored("questions.wording", wording),
    search,
    marks: marks[i] ?? [],
    page,
  }));
}

/** SPEC §6 (2026-09-20, #919) — the published pages' own questions, on the
 *  latest pass alone, each naming one of `content-fixture.ts`'s asked pages. */
const PAGE_SPECS: readonly (readonly [Spec, readonly AnswerMark[]])[] = [
  [["Which payment terms should a small business offer?", "payment terms for a small business", OWN("Choosing payment terms", 13)], [O, O, L]],
  [["Do I charge VAT on a freelance invoice?", "vat on a freelance invoice", OWN("VAT on a freelance invoice", 12)], [X, N, O]],
  [["How should I number my invoices?", "invoice numbering rules", OWN("Invoice numbering rules", 11)], [O, O, N]],
  [["What should a late payment reminder say?", "late payment reminder", OWN("Late payment reminders that work", 3)], [X, O, U]],
];

const PAGE_QUESTIONS: readonly AnswerQuestion[] = Object.freeze(
  PAGE_SPECS.map(([[wording, search, page], marks], i) => ({
    n: SPECS.length + i + 1,
    wording: fromStored("questions.wording", wording),
    search,
    marks,
    page,
  }))
);

const PASSES: readonly AnswerWeekFacts[] = Object.freeze(
  WEEKS.map((marks, i) => ({
    weekStart: monday(WEEKS.length - 1 - i),
    questions: questionsFor(marks),
    // The page questions belong to the pass that asked them — the latest.
    ...(i === WEEKS.length - 1 ? { pageQuestions: PAGE_QUESTIONS } : {}),
  }))
);

export const FIXTURE_ANSWERS_FACTS: AnswersFacts = Object.freeze({
  weeks: PASSES,
  measuredAt: MEASURED_AT,
});
