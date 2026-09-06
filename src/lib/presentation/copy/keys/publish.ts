// src/lib/presentation/copy/keys/publish.ts — BP-020 decision 5, WO-041
//
// Publishing's sentences. Seeded empty by WO-041; the block that owns
// publishing fills this file and touches no other partition.
//
// 2026-09-06, issue #47 (REQ-063): the four words a published page's
// weekly standing is spoken as. They live here, and not in `keys/mail.ts`,
// because they are not the mail's: §4.5's Overview and §4.6's calendar
// speak the same four, and one home is what stops a screen and a mail
// wording the same verdict differently. Every one is owner-owed and
// **empty** rather than carrying the `TODO(copy)` marker — the owner's
// 2026-09-05 ruling on #93 divides the two representations by destination,
// and the first surface to read these is the Monday mail, where "a mail
// never ships a placeholder": `copy()` throws on the key and the send is
// logged `not-composable` rather than a customer receiving a blank verdict
// on their own page.
//
// The fourth is not a fourth verdict: REQ-063 c6's page carries it "in
// place of the three", and the line naming *which* of the five causes
// happened, with the date of the last verdict it received, is a separate
// sentence a screen speaks — owner-owed and not minted here (the mail
// carries the standing, not the explanation).
import type { CopyPartition } from "../registry.ts";

export const PUBLISH_COPY = Object.freeze({
  "verdict.page.working": ["", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.too_early": ["", { slots: {}, fixedBy: "REQ-063 c2" }],
  "verdict.page.not_working": ["", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.not_judgeable": ["", { slots: {}, fixedBy: "REQ-063 c6" }],

  // 2026-09-06, issue #46 (BUILD §9, REQ-045 c4). The two things the three
  // draft actions can answer when the state machine refuses.
  //
  // They are two keys and not one because the two refusals are two
  // different facts about the customer's page: the action is not one the
  // page can take from where it is (`not_a_transition` — someone else
  // already moved it, or the control was stale), or it is and something
  // named is holding it (`guard`). Collapsing them would tell a customer
  // whose page had already published that "something is holding it".
  //
  // The `{state}` slot is the state the page still holds — the refusal
  // never leaves it somewhere else.
  "publish.action.refused.notATransition": [
    "TODO(copy)",
    { slots: { state: "text" }, fixedBy: "REQ-056 c2" },
  ],
  "publish.action.refused.guard": [
    "TODO(copy)",
    { slots: { state: "text" }, fixedBy: "REQ-056 c2" },
  ],
}) satisfies CopyPartition;
