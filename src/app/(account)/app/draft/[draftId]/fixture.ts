// BUILD §4.6 — the draft view's facts, as a fixture.
//
// Issue #17 builds the draft view on FIXTURE data behind the typed provider
// in `provider.ts`. Every field below stands in for a read that does not
// exist yet, each naming the issue that will supply it:
//
//   bodyMd / bodyMdGenerated / groundedFact → §8 generation (#43)
//   claim                                   → §8's claim check (#43)
//   state / autoApprovesAt                  → §9 publishing (#45, #46)
//   firstEditedAt / lastSavedAt             → the drafts row (§10)
//   mode / timeZone                         → §4.3 setup and §4.7 settings
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

export const FIXTURE_DRAFTS: Readonly<Record<string, DraftFacts>> = Object.freeze({
  [FIXTURE_DRAFT_ID]: UNEDITED,
  [FIXTURE_EDITED_DRAFT_ID]: EDITED,
});
