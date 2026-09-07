// BUILD §4.6 — the draft view's facts, as a fixture.
//
// **This is the reserved fixture account's draft, and nobody else's.**
// `provider.ts` answers `isReservedFixtureAccount` from here and reads every
// other account's draft from `store.ts`, so what this file holds is one
// account's data rather than a placeholder for a missing read. It is what
// keeps the layout and visual sweeps deterministic.
//
// Where each field comes from for a live account:
//
//   bodyMd / bodyMdGenerated / groundedFact → §8 generation
//   claim                                   → §8's claim check
//   state / autoApprovesAt                  → §9 publishing
//   firstEditedAt / lastSavedAt             → the `drafts` row (§10)
//   mode / timeZone                         → the `sites` row
//
// The ids are the calendar's own (`../../calendar/fixture.ts` keys every
// draft `draft-{date}`), so "Read the full page" on the day panel lands on
// a draft this file holds rather than on a not-found line. `draft-2026-09-15`
// is the calendar fixture's `in_review` page — the one stage §4.6 gives this
// view a way in from — and it is the id the layout conformance sweep renders.
//
// Nothing here moves with the clock: a fixture whose dates drifted would
// make the layout sweep non-deterministic, and the veto deadline is a
// number this screen states.
import type { PageRecord } from "@/lib/publish/record";
// The pure leaf, not the barrel: `record/index.ts` resolves `publishDb()`,
// and this fixture is on the reserved account's path, which reaches no
// database at all (`provider.ts` says why).
import { SEO_COPY } from "@/lib/publish/record/lines";
import { FIXTURE_SHELL_FACTS } from "../../_shell/fixture";
import type { DraftFacts } from "./model";

// The zone and the publishing mode are the *site's*, not this screen's, so
// they are read from the one fixture that already declares them rather
// than declared a second time: the shell states the mode on every screen
// (REQ-040 c3), and a draft view that disagreed with the sidebar about
// whether autopilot is on would be stating two different futures for the
// same page.
export const FIXTURE_TIME_ZONE = FIXTURE_SHELL_FACTS.timeZone;
export const FIXTURE_MODE = FIXTURE_SHELL_FACTS.mode;
/** The draft the calendar's day panel opens on today, and the id
 *  `tests/ui/layout/routes.ts` fills `[draftId]` with. */
export const FIXTURE_DRAFT_ID = "draft-2026-09-15";
/** The second fixture draft: the same page after the customer has edited
 *  it. It carries the authorship note, an outstanding claim check and a
 *  grounded fact the edit removed — the three states the unedited draft
 *  cannot show. */
export const FIXTURE_EDITED_DRAFT_ID = "draft-2026-09-16";
/** The third fixture draft: the same page after it went out (issue #217).
 *  It is the only one that can carry a *record* worth drawing — a page in
 *  review has never been delivered, so its record is honestly two rows —
 *  and it is what makes REQ-060 criterion 4's line visible on a preview at
 *  all. Its WordPress had no SEO plugin, which is the case c4 is about. */
export const FIXTURE_PUBLISHED_DRAFT_ID = "draft-2026-09-14";

/** The verbatim passage the page is grounded in, and the one this fixture's
 *  body contains word for word. Model output and customer-facing data, not
 *  product voice: the copy registry does not speak a fact ReachKit read off
 *  someone else's page. */
const GROUNDED_FACT =
  "HubSpot's free tier caps custom properties at ten per object, which a five-person sales team reaches inside a quarter.";

const BODY = [
  "# How to choose a CRM for a small team",
  "",
  "Most comparison pages rank tools by feature count. A five-person team does not",
  "run out of features; it runs out of the two or three limits its own way of",
  "working pushes against first. Those limits are what to compare.",
  "",
  "## Start from the limit you will hit first",
  "",
  GROUNDED_FACT,
  "That is the shape of the question: not whether a tier is free, but which",
  "ceiling it puts in front of the way you already work.",
  "",
  "## Three limits worth checking before anything else",
  "",
  "- **Custom fields per object.** The number that decides whether your pipeline",
  "  fits the tool or the tool reshapes your pipeline.",
  "- **Seats included at the tier you would actually buy.** Per-seat pricing is",
  "  the line item that grows with the team, and it grows first.",
  "- **What leaves with you.** A full export in an open format, on demand, with",
  "  no support ticket in the way.",
  "",
  "## What this means for a team of five",
  "",
  "Pick the tier whose first ceiling is furthest from your next twelve months,",
  "not the one with the longest feature list. The list is the same everywhere;",
  "the ceilings are not.",
  "",
  "> A CRM you outgrow in a quarter costs more than the one you paid for.",
  "",
  "Set the fields you need on day one, export once to confirm you can, and",
  "revisit the choice when the team doubles.",
].join("\n");

/** The same page after the customer rewrote its opening — the grounded fact
 *  is gone, which is exactly the case REQ-045 criterion 8 asks the highlight
 *  to drop. */
const EDITED_BODY = BODY.replace(
  GROUNDED_FACT,
  "Every free tier has a ceiling somewhere, and the one that matters is the one your own team reaches first."
);

const READ_AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));
const LAST_SAVED_AT = new Date(Date.UTC(2026, 8, 15, 11, 25, 0));
/** §9's veto window on the calendar fixture's in-review page: 24 hours
 *  after it entered review, the same instant that fixture states. */
const AUTO_APPROVES_AT = new Date(Date.UTC(2026, 8, 16, 14, 0, 0));
/** The moment the one check ran on the delivered fixture page — 24 hours
 *  after it went out, which is the only interval §9 has. */
const CHECKED_AT = new Date(Date.UTC(2026, 8, 15, 9, 0, 0));

/** The record of a page that has not been delivered: no address was ever
 *  made live, so no check will ever run. Two rows and no invention — the
 *  arms are `PageRecord`'s own. */
const NOT_DELIVERED: PageRecord = {
  draftId: FIXTURE_DRAFT_ID,
  state: "in_review",
  opportunityId: "opportunity-fixture",
  targetQuery: "best crm for a small team",
  measuredAt: READ_AT,
  mode: "approved",
  address: {
    offered: false,
    because: "never_made_live",
    copy: "record.address.neverMadeLive",
  },
  unpublishOutcome: null,
  verification: { kind: "never", because: "no_live_address" },
  seoNote: null,
};

/** The record of the page that went out: readable at its address, found by
 *  the one check, and delivered into a WordPress with no SEO plugin to
 *  write the title and description into (REQ-060 c4). */
const DELIVERED: PageRecord = {
  ...NOT_DELIVERED,
  draftId: FIXTURE_PUBLISHED_DRAFT_ID,
  state: "published",
  address: {
    offered: true,
    label: "record.address.publiclyReadableAt",
    url: "https://blog.example.com/how-to-choose-a-crm-for-a-small-team",
  },
  verification: {
    kind: "done",
    result: {
      outcome: "found",
      checks: {
        reachable: { kind: "measured", value: true, at: CHECKED_AT },
        indexable: { kind: "measured", value: true, at: CHECKED_AT },
        sitemap: { kind: "measured", value: true, at: CHECKED_AT },
        aiReadable: { kind: "measured", value: true, at: CHECKED_AT },
      },
      checkedAt: CHECKED_AT,
    },
  },
  // Read from the record module rather than spelled here: REQ-060 c4's
  // key is named in exactly three files in `src/` and no surface is one of
  // them (`tests/publish/record/seo-note.test.ts`). A fixture that repeated
  // the literal would be a fourth.
  seoNote: SEO_COPY.noSeoPlugin,
};

const UNEDITED: DraftFacts = {
  draftId: FIXTURE_DRAFT_ID,
  title: "How to choose a CRM for a small team",
  bodyMd: BODY,
  bodyMdGenerated: BODY,
  state: "in_review",
  firstEditedAt: null,
  groundedFact: {
    fact: GROUNDED_FACT,
    url: "https://www.hubspot.com/pricing/crm",
    readAt: READ_AT,
  },
  claim: { state: "passed", at: READ_AT },
  mode: FIXTURE_MODE,
  autoApprovesAt: AUTO_APPROVES_AT,
  lastSavedAt: null,
  record: NOT_DELIVERED,
  timeZone: FIXTURE_TIME_ZONE,
};

const EDITED: DraftFacts = {
  ...UNEDITED,
  draftId: FIXTURE_EDITED_DRAFT_ID,
  bodyMd: EDITED_BODY,
  firstEditedAt: LAST_SAVED_AT,
  // §4.6: the badge drops until the check re-runs on save.
  claim: { state: "outstanding" },
  lastSavedAt: LAST_SAVED_AT,
};

/** The page as it stands after publication: no veto window left to run, no
 *  unsaved buffer, and a record with every row it can have. */
const PUBLISHED: DraftFacts = {
  ...UNEDITED,
  draftId: FIXTURE_PUBLISHED_DRAFT_ID,
  state: "published",
  autoApprovesAt: null,
  record: DELIVERED,
};

export const FIXTURE_DRAFTS: Readonly<Record<string, DraftFacts>> = Object.freeze({
  [FIXTURE_DRAFT_ID]: UNEDITED,
  [FIXTURE_EDITED_DRAFT_ID]: EDITED,
  [FIXTURE_PUBLISHED_DRAFT_ID]: PUBLISHED,
});
