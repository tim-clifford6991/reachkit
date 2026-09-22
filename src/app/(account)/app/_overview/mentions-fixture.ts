// SPEC §4 · §6 (2026-09-22, #1004) — the two mentions cards' facts, as a
// fixture.
//
// **This is the reserved fixture account's, and nobody else's.**
// `mentions-provider.ts` answers `isReservedFixtureAccount` from here and
// reads every other account's weeks live, so what this file holds is one
// account's data rather than a placeholder for a missing read. It is what
// keeps the layout and axe sweeps deterministic.
//
// **It agrees with the fixtures beside it**: the same CRM market
// `answers-fixture.ts` and `search-fixture.ts` use, the same four Mondays
// that fixture's four passes measure, and the same `content.example.com`
// pages the grid above already links to. Two fixtures disagreeing about
// what this customer sells would be worse than no fixture at all.
//
// **The frame it shows is the dense one, on purpose**: more un-tracked
// questions than the top-12 cut admits (so the "showing 12 of n" line is
// exercised rather than skipped), a question long enough to wrap at 390, a
// question the vendor gave no demand figure for, one answered by two
// engines, one whose engine this product has no word for, a week that was
// skipped for the cap, and several pages cited by different numbers of
// questions — so the sweep measures the screen at its widest.
import type { MentionWeek, StoredMention } from "@/lib/mentions";
import type { MentionsFacts } from "./mentions-model";

const MS_PER_WEEK = 7 * 86_400_000;

/** The Monday `answers-fixture.ts` measures on, as the `YYYY-MM-DD` string
 *  a `week_start` is written as. */
function monday(back: number): string {
  const at = new Date(Date.UTC(2026, 7, 31) - back * MS_PER_WEEK);
  return at.toISOString().slice(0, 10);
}

const PAGE = (slug: string): string => `https://content.example.com/${slug}`;

function mention(
  weekStart: string,
  question: string,
  a: {
    engine?: string | null;
    citedUrl?: string | null;
    volume?: number | null;
    first?: string | null;
  } = {}
): StoredMention {
  return {
    weekStart,
    question,
    engine: a.engine === undefined ? "google_ai_overview" : a.engine,
    model: null,
    citedUrl: a.citedUrl ?? null,
    aiSearchVolume: a.volume === undefined ? 210 : a.volume,
    monthlySearches: null,
    // Dates that differ, so the "first seen" line on the sweep's own frame
    // shows a column that varies rather than one word repeated twelve
    // times. Derived from the question so it is stable across runs.
    firstSeenAt:
      a.first === undefined
        ? new Date(Date.UTC(2026, 4 + (question.length % 3), 1 + (question.length % 27)))
        : a.first === null
          ? null
          : new Date(a.first),
    lastSeenAt: null,
  };
}

const W0 = monday(0);
const W1 = monday(1);
const W2 = monday(2);
const W3 = monday(3);

/** The window's four Mondays. The oldest was skipped for the weekly cap —
 *  a real state, and the one that proves a skipped week neither adds rows
 *  nor makes the window read as a zero. */
const WEEKS: readonly MentionWeek[] = [
  { weekStart: W3, status: "skipped_cap", totalCount: null, mentions: [] },
  {
    weekStart: W2,
    status: "measured",
    totalCount: 1840,
    mentions: [
      mention(W2, "how do I move contacts from a spreadsheet into a CRM", {
        citedUrl: PAGE("move-contacts-spreadsheet-crm"),
        volume: 1600,
      }),
      mention(W2, "what does a CRM actually do for a two person business", { volume: 880 }),
      // The same question, answered by a second engine — one row on the
      // card, with both engines named.
      mention(W2, "what does a CRM actually do for a two person business", {
        engine: "chatgpt",
        volume: 880,
      }),
    ],
  },
  {
    weekStart: W1,
    status: "measured",
    totalCount: 1902,
    mentions: [
      mention(W1, "how do I move contacts from a spreadsheet into a CRM", {
        citedUrl: PAGE("move-contacts-spreadsheet-crm"),
        volume: 1600,
      }),
      mention(W1, "cheapest CRM with email tracking", {
        citedUrl: PAGE("crm-email-tracking"),
        volume: 1290,
      }),
      mention(W1, "is a CRM worth it for a freelancer", { volume: 640 }),
      // The vendor gave no demand figure for this one: it sorts last
      // rather than as a zero.
      mention(W1, "CRM that works offline", { volume: null }),
    ],
  },
  {
    weekStart: W0,
    status: "measured",
    totalCount: 1988,
    mentions: [
      mention(W0, "how do I move contacts from a spreadsheet into a CRM", {
        citedUrl: PAGE("move-contacts-spreadsheet-crm"),
        volume: 1600,
      }),
      mention(W0, "cheapest CRM with email tracking", {
        citedUrl: PAGE("crm-email-tracking"),
        volume: 1290,
      }),
      // A long one, to be wrapped rather than clamped at 390.
      mention(W0, "what should a small business look for when it is choosing between a CRM and a shared inbox", {
        citedUrl: PAGE("crm-vs-shared-inbox"),
        volume: 1150,
      }),
      mention(W0, "do I need a CRM if I already use a shared inbox", {
        citedUrl: PAGE("crm-vs-shared-inbox"),
        volume: 1040,
      }),
      mention(W0, "how long does it take to set up a CRM", { volume: 930 }),
      mention(W0, "CRM for a team that lives in email", {
        citedUrl: PAGE("crm-email-tracking"),
        volume: 820,
      }),
      mention(W0, "can two people share one CRM licence", { volume: 720 }),
      mention(W0, "what to import first when you start a CRM", { volume: 610 }),
      mention(W0, "CRM pricing for under five seats", { volume: 540 }),
      mention(W0, "does a CRM replace a spreadsheet", { volume: 480 }),
      mention(W0, "simplest CRM to learn in a day", { volume: 430 }),
      // An engine this product has no written word for: the question is
      // still shown, without an engine chip.
      mention(W0, "CRM with a phone app that works", { engine: "some_new_platform", volume: 360 }),
      // The thirteenth and fourteenth by demand: the top-12 cut is what
      // keeps them off the card, and the line says twelve of fourteen.
      mention(W0, "how do I stop paying for a CRM I do not use", { volume: 300 }),
      // One of the tracked twelve, from `answers-fixture.ts`. It is cited,
      // so it counts on *Cited pages*, and it is excluded from *Also
      // appearing for* — which is the whole of that card's definition.
      mention(W0, "best crm for small teams", {
        citedUrl: PAGE("best-crm-small-teams"),
        volume: 2900,
      }),
    ],
  },
];

/** The searches the fixture account already tracks — the twelve
 *  `answers-fixture.ts` draws. Only the one that actually appears among the
 *  mentions above has to be here for the exclusion to be visible, but the
 *  set is what the provider hands the model for a real account too, so the
 *  shape is the same. */
const TRACKED: readonly string[] = ["best crm for small teams"];

export const FIXTURE_MENTIONS_FACTS: MentionsFacts = { weeks: WEEKS, tracked: TRACKED };
